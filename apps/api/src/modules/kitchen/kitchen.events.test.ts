import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { KitchenEventSchema } from '@sku-cook/shared';
import { buildApp } from '../../app.js';
import { ApiError } from '../common/errors.js';

describe('厨房SSE真实HTTP传输（数据库模拟）', () => {
  let app: ReturnType<typeof buildApp>;
  let origin: string;
  const controllers: AbortController[] = [];
  const alice = `sku_session=${'a'.repeat(64)}`;
  const bob = `sku_session=${'b'.repeat(64)}`;
  const state = {
    session: {
      recipeIds: [],
      items: [],
      activeRecipeId: null,
      revision: 0,
      updatedAt: null,
      recipes: [],
    },
    pollIntervalSeconds: 10,
  };
  function asUser(cookie: string) {
    const id = cookie === alice ? 7 : 8;
    const session = {
      userId: id,
      tokenHash: '',
      createdAt: new Date(),
      user: { id, username: id === 7 ? 'Alice' : 'Bob' },
    };
    vi.mocked(app.prisma.authSession.findUnique).mockResolvedValue(session);
  }
  beforeEach(async () => {
    app = buildApp('postgresql://localhost/test');
    vi.spyOn(app.prisma.authSession, 'findUnique');
    asUser(alice);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('测试监听地址无效');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    for (const controller of controllers.splice(0)) controller.abort();
    await app.close();
    vi.restoreAllMocks();
  });
  async function stream(cookie = alice) {
    asUser(cookie);
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(`${origin}/api/kitchen/events`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-store');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    return {
      response,
      reader,
      controller,
      async next() {
        const timeout = setTimeout(() => controller.abort(), 2000);
        try {
          for (;;) {
            const boundary = buffer.indexOf('\n\n');
            if (boundary >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              if (frame.startsWith('data: '))
                return KitchenEventSchema.parse(JSON.parse(frame.slice(6)));
            } else {
              const chunk = await reader.read();
              if (chunk.done) throw new Error('连接提前结束');
              buffer += decoder.decode(chunk.value, { stream: true });
            }
          }
        } finally {
          clearTimeout(timeout);
        }
      },
    };
  }
  it('要求有效会话、拒绝客户端选择用户并限制每用户连接数', async () => {
    await request(app.server).get('/api/kitchen/events').expect(401);
    vi.mocked(app.prisma.authSession.findUnique).mockResolvedValueOnce(null);
    await request(app.server).get('/api/kitchen/events').set('Cookie', alice).expect(401);
    await request(app.server).get('/api/kitchen/events?userId=8').set('Cookie', alice).expect(400);
    for (let index = 0; index < 6; index += 1) {
      expect(await (await stream()).next()).toEqual({ type: 'ready' });
    }
    await request(app.server).get('/api/kitchen/events').set('Cookie', alice).expect(429);
    const other = await stream(bob);
    expect(await other.next()).toEqual({ type: 'ready' });
  });
  it('仅在成功写入后通知对应账号，不推送其他账号的数据或失败写入', async () => {
    vi.spyOn(app.prisma, '$transaction')
      .mockRejectedValueOnce(new ApiError(409, 'SESSION_CONFLICT', '菜单已更新'))
      .mockResolvedValue(state);
    const a = await stream();
    const b = await stream(bob);
    expect(await a.next()).toEqual({ type: 'ready' });
    expect(await b.next()).toEqual({ type: 'ready' });
    asUser(alice);
    const write = () =>
      request(app.server)
        .put('/api/kitchen/session')
        .set('Cookie', alice)
        .send({ items: [{ recipeId: 11, targetServings: 2 }], expectedRevision: 0 });
    await write().expect(409);
    await write().expect(200);
    expect(await a.next()).toEqual({ type: 'changed' });
    asUser(bob);
    await request(app.server)
      .put('/api/kitchen/session')
      .set('Cookie', bob)
      .send({ items: [{ recipeId: 11, targetServings: 2 }], expectedRevision: 0 })
      .expect(200);
    expect(await b.next()).toEqual({ type: 'changed' });
    let received = false;
    const read = a.reader
      .read()
      .then(() => {
        received = true;
      })
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(received).toBe(false);
    a.controller.abort();
    await read;
  });
  it('菜谱删除或导入也通知，爱心偏好不触发厨房刷新', async () => {
    const a = await stream();
    await a.next();
    vi.spyOn(app.prisma, '$transaction').mockResolvedValue(undefined);
    await request(app.server).delete('/api/recipes/11').set('Cookie', alice).expect(204);
    expect(await a.next()).toEqual({ type: 'changed' });
    vi.spyOn(app.prisma, '$executeRaw').mockResolvedValue(1);
    await request(app.server)
      .put('/api/recipes/11/like')
      .set('Cookie', alice)
      .send({ isLiked: true })
      .expect(200);
    vi.mocked(app.prisma.$transaction).mockResolvedValue([11]);
    vi.spyOn(app.prisma.recipe, 'findMany').mockResolvedValue([]);
    await request(app.server)
      .post('/api/recipes/import')
      .set('Cookie', alice)
      .send({
        version: 1,
        recipes: [
          {
            title: '测试菜',
            servings: 2,
            ingredients: [{ name: '鸡蛋', amount: '2', unit: '个' }],
            steps: [{ order: 1, text: '炒熟' }],
          },
        ],
      })
      .expect(201);
    expect(await a.next()).toEqual({ type: 'changed' });
  });
  it('退出登录和服务关闭会结束现有连接，不留下长连接阻塞退出', async () => {
    const a = await stream();
    await a.next();
    vi.spyOn(app.prisma.authSession, 'deleteMany').mockResolvedValue({ count: 1 });
    await request(app.server).delete('/api/auth/session').set('Cookie', alice).expect(204);
    expect((await a.reader.read()).done).toBe(true);
    const b = await stream(bob);
    await b.next();
    const closing = app.close();
    expect((await b.reader.read()).done).toBe(true);
    await closing;
  });
  it('心跳不读取数据库，连接到期后结束以重新验证会话', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const transaction = vi.spyOn(app.prisma, '$transaction');
    const a = await stream();
    await a.next();
    const heartbeat = interval.mock.calls.find(([, delay]) => delay === 30000)?.[0];
    if (typeof heartbeat !== 'function') throw new Error('未安排心跳');
    heartbeat();
    expect(await a.next()).toEqual({ type: 'heartbeat' });
    expect(transaction).not.toHaveBeenCalled();
    expect(app.prisma.authSession.findUnique).toHaveBeenCalledOnce();
    const expire = timeout.mock.calls.find(([, delay]) => delay === 300000)?.[0];
    if (typeof expire !== 'function') throw new Error('未安排会话复验');
    expire();
    expect(await a.next()).toEqual({ type: 'reconnect' });
    expect((await a.reader.read()).done).toBe(true);
  });
});
