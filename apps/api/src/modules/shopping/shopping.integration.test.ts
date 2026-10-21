import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CookShoppingBatchInputSchema, ShoppingPreviewSchema } from '@sku-cook/shared';
import { z } from 'zod';
import { buildApp } from '../../app.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (
    url.hostname !== '127.0.0.1' ||
    url.port !== '15436' ||
    url.pathname !== '/sku_cook_test_shopping'
  ) {
    throw new Error('采购集成测试仅允许专用本机15436端口的sku_cook_test_shopping临时库');
  }
}
describe.skipIf(!databaseUrl)('采购持久批次与受限转发（真实数据库、模拟 Todo 传输）', () => {
  const integration = {
    origin: 'https://todo.example.test',
    token: 'test-only-'.padEnd(64, 'x'),
    userId: '0',
  };
  const app = buildApp(
    databaseUrl ?? '',
    { logger: false },
    { shoppingIntegration: integration, secureCookie: false },
  );
  const phone = request.agent(app.server);
  const other = request.agent(app.server);
  let recipeId: number;
  const fetchMock = vi.fn<typeof fetch>();
  beforeAll(async () => {
    await app.ready();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
    const registered = await phone
      .post('/api/auth/register')
      .send({ username: `Shop${suffix}`, email: `${suffix}@example.test`, password: randomUUID() })
      .expect(201);
    integration.userId = String(registered.body.user.id);
    await other
      .post('/api/auth/register')
      .send({
        username: `Other${suffix}`,
        email: `other${suffix}@example.test`,
        password: randomUUID(),
      })
      .expect(201);
    const created = await phone
      .post('/api/recipes')
      .send({
        title: '采购测试菜',
        servings: 2,
        ingredients: [
          { name: '番茄', amount: '2', unit: '个' },
          { name: '番茄', amount: '1', unit: '个' },
          { name: '盐', amount: '适量' },
          { name: '糖', amount: '2～3', unit: '勺' },
        ],
        steps: [{ order: 1, text: '做好即可。' }],
      })
      .expect(201);
    recipeId = created.body.recipe.id;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });
  afterAll(async () => {
    await app.close();
  });
  async function draft() {
    const preview = ShoppingPreviewSchema.parse(
      (
        await phone
          .post('/api/shopping/preview')
          .send({ items: [{ recipeId, targetServings: 3 }] })
          .expect(200)
      ).body,
    );
    return CookShoppingBatchInputSchema.parse({
      batchId: randomUUID(),
      schemaVersion: 1,
      title: '周末晚餐采购',
      plannedDate: '2026-10-18',
      ...preview,
    });
  }
  function success(id: string, replayed = false) {
    const taskId = randomUUID();
    return new Response(
      JSON.stringify({
        data: { id, batchId: id, task: { id: taskId } },
        meta: { taskId, shoppingId: id, url: `${integration.origin}/shopping/${id}`, replayed },
      }),
      { status: replayed ? 200 : 201, headers: { 'Content-Type': 'application/json' } },
    );
  }
  it('校验份数、精确合并、原文保留和账号隔离，每次重试都检查绑定身份', async () => {
    const payload = await draft();
    expect(payload.recipes[0]?.servings).toBe('3人份');
    expect(payload.items.map((item) => item.quantityText)).toEqual(['4.5', '适量', '2～3']);
    expect(payload.items[0]?.sources).toHaveLength(2);
    expect(payload.items[0]?.sources[0]?.originalText).toContain('番茄 2个');
    await other
      .post('/api/shopping/preview')
      .send({ items: [{ recipeId, targetServings: 3 }] })
      .expect(403);
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    await other.post(`/api/shopping/batches/${payload.batchId}/send`).send({}).expect(403);
    integration.userId = '0';
    await phone.post(`/api/shopping/batches/${payload.batchId}/send`).send({}).expect(403);
    integration.userId = String((await phone.get('/api/auth/session').expect(200)).body.user.id);
  });
  it('先持久化，再发送；超时重试保持同一快照与编号，成功回执可打开', async () => {
    const payload = await draft();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockImplementationOnce(async (_url, options) => {
        expect(await app.prisma.shoppingBatch.count({ where: { id: payload.batchId } })).toBe(1);
        expect(options?.headers).toEqual({
          Authorization: `Bearer ${integration.token}`,
          'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(options?.body))).toEqual(payload);
        throw new TypeError('simulated response lost');
      })
      .mockResolvedValueOnce(success(payload.batchId, true));
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    const first = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(first.body.batch.status).toBe('failed');
    expect(first.body.batch.message).toContain('可能已送达');
    await app.prisma.recipe.update({ where: { id: recipeId }, data: { title: '发送后菜谱改名' } });
    const second = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(second.body.batch.payload).toEqual(payload);
    expect(second.body.batch.receipt).toMatchObject({
      shoppingId: payload.batchId,
      replayed: true,
      url: `${integration.origin}/shopping/${payload.batchId}`,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(fetchMock.mock.calls[0]?.[1]?.body);
    await phone.post(`/api/shopping/batches/${payload.batchId}/send`).send({}).expect(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const listed = await phone.get('/api/shopping/batches').expect(200);
    expect(listed.text).not.toContain(integration.token);
    expect(
      listed.body.batches.some(
        (batch: { payload: { batchId: string } }) => batch.payload.batchId === payload.batchId,
      ),
    ).toBe(true);
  });
  it('拒绝不同内容复用 ID，重复确认不创建新行', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    const response = await phone
      .put(`/api/shopping/batches/${payload.batchId}`)
      .send({ ...payload, title: '不同内容' })
      .expect(409);
    expect(response.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await app.prisma.shoppingBatch.count({ where: { id: payload.batchId } })).toBe(1);
    await expect(
      app.prisma.user.delete({ where: { id: Number(integration.userId) } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await phone
      .put(`/api/shopping/batches/${randomUUID()}`)
      .send({ ...payload, userId: 999 })
      .expect(400);
  });
  it('超出数据库编号范围的菜谱在查询前作为输入错误拒绝，不变成500', async () => {
    await phone
      .post('/api/shopping/preview')
      .send({ items: [{ recipeId: 2147483648, targetServings: 2 }] })
      .expect(400);
    const payload = await draft();
    const invalid = {
      ...payload,
      recipes: [{ recipeId: '2147483648', title: '无效菜谱', servings: '2人份' }],
      items: payload.items.map((item) => ({
        ...item,
        sources: item.sources.map((source) => ({ ...source, recipeId: '2147483648' })),
      })),
    };
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(invalid).expect(400);
    expect(await app.prisma.shoppingBatch.count({ where: { id: payload.batchId } })).toBe(0);
  });
  it.each(['TimeoutError', 'AbortError'])('外部%s保留失败状态、原ID和快照', async (name) => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockRejectedValueOnce(new DOMException('simulated request interruption', name));
    const response = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(response.body.batch.status).toBe('failed');
    expect(response.body.batch.errorCode).toBe('TODO_NETWORK_UNCERTAIN');
    expect(response.body.batch.payload).toEqual(payload);
  });
  it('即使绑定换为另一账号也不能读取或引用旧账号的批次与菜谱', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    const ownerId = integration.userId;
    integration.userId = String((await other.get('/api/auth/session').expect(200)).body.user.id);
    try {
      await other.get(`/api/shopping/batches/${payload.batchId}`).expect(404);
      await other.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(404);
      await other
        .post('/api/shopping/preview')
        .send({ items: [{ recipeId, targetServings: 2 }] })
        .expect(404);
      await other
        .put(`/api/shopping/batches/${randomUUID()}`)
        .send({ ...payload, batchId: randomUUID() })
        .expect(400);
      const foreign = { ...payload, batchId: randomUUID() };
      await other.put(`/api/shopping/batches/${foreign.batchId}`).send(foreign).expect(404);
      expect((await other.get('/api/shopping/batches').expect(200)).body.batches).toEqual([]);
    } finally {
      integration.userId = ownerId;
    }
  });
  it('崩溃租约到期后可由新应用实例读取原快照并重试', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    await app.prisma.shoppingBatch.update({
      where: { id: payload.batchId },
      data: { status: 'sending', attemptId: randomUUID(), leaseUntil: new Date(Date.now() - 1000) },
    });
    const restarted = buildApp(
      databaseUrl ?? '',
      { logger: false },
      { shoppingIntegration: integration, secureCookie: false },
    );
    await restarted.ready();
    try {
      const cookie = (await phone.get('/api/auth/session').expect(200)).headers['set-cookie'];
      expect(cookie).toBeDefined();
      const restored = await request(restarted.server)
        .get(`/api/shopping/batches/${payload.batchId}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(restored.body.batch.payload).toEqual(payload);
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockResolvedValueOnce(success(payload.batchId, true));
      const sent = await request(restarted.server)
        .post(`/api/shopping/batches/${payload.batchId}/send`)
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      expect(sent.body.batch.status).toBe('succeeded');
      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(payload);
    } finally {
      await restarted.close();
    }
  });
  it('未启用时明确503，未登录401；拒绝超过256KiB正文', async () => {
    const disabled = buildApp(databaseUrl ?? '', { logger: false }, { secureCookie: false });
    await disabled.ready();
    try {
      const cookie = (await phone.get('/api/auth/session').expect(200)).headers['set-cookie'];
      await request(disabled.server).get('/api/shopping/batches').expect(401);
      const unavailable = await request(disabled.server)
        .get('/api/shopping/batches')
        .set('Cookie', cookie)
        .expect(503);
      expect(unavailable.body.error.code).toBe('SHOPPING_NOT_CONFIGURED');
      const payload = await draft();
      await phone
        .put(`/api/shopping/batches/${payload.batchId}`)
        .send({ ...payload, title: '大'.repeat(90000) })
        .expect(413);
      expect(await app.prisma.shoppingBatch.count({ where: { id: payload.batchId } })).toBe(0);
    } finally {
      await disabled.close();
    }
  });
  it('串行化同批次发送，传输未结束时不发送第二次', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    let finish: ((value: Response) => void) | undefined;
    let started: (() => void) | undefined;
    const reached = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
          started?.();
        }),
    );
    const first = phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .then((response) => response);
    await reached;
    const duplicate = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(409);
    expect(duplicate.body.error.code).toBe('SHOPPING_SEND_IN_PROGRESS');
    finish?.(success(payload.batchId));
    expect((await first).body.batch.status).toBe('succeeded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    [401, 'COOK_AUTH_REQUIRED', '服务端集成配置'],
    [404, 'INTEGRATION_NOT_CONFIGURED', '尚未启用'],
    [429, 'RATE_LIMITED', '过于频繁'],
    [503, 'UNAVAILABLE', '重试原批次'],
    [409, 'IDEMPOTENCY_CONFLICT', '不能自动换 ID'],
  ])('保留 Todo %i 失败与原批次', async (status, code, message) => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code } }), { status }));
    const result = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(result.body.batch.message).toContain(message);
    expect(result.body.batch.status).toBe(status === 409 ? 'conflict' : 'failed');
    expect(result.body.batch.payload).toEqual(payload);
  });
  it('上游401即使返回非JSON，也明确提示专用凭据问题而不是盲目重试', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(result.body.batch.errorCode).toBe('TODO_HTTP_401');
    expect(result.body.batch.message).toContain('服务端集成配置');
    expect(result.body.batch.receipt).toBeNull();
  });
  it('拒绝恶意回执链接，不向浏览器返回不可信URL', async () => {
    const payload = await draft();
    await phone.put(`/api/shopping/batches/${payload.batchId}`).send(payload).expect(200);
    const raw = z
      .object({
        data: z.object({ id: z.uuid(), batchId: z.uuid(), task: z.object({ id: z.uuid() }) }),
        meta: z.object({
          replayed: z.boolean(),
          taskId: z.uuid(),
          shoppingId: z.uuid(),
          url: z.url(),
        }),
      })
      .parse(await success(payload.batchId).json());
    raw.meta.url = `https://evil.example.test/shopping/${payload.batchId}`;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(raw), { status: 201 }));
    const response = await phone
      .post(`/api/shopping/batches/${payload.batchId}/send`)
      .send({})
      .expect(200);
    expect(response.body.batch.errorCode).toBe('TODO_INVALID_RECEIPT');
    expect(response.text).not.toContain('evil.example');
  });
});
