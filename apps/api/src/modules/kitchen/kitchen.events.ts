import type { FastifyInstance, FastifyReply } from 'fastify';
import { KitchenEventSchema, type KitchenEvent } from '@sku-cook/shared';
import { authenticatedUser, sessionToken } from '../auth/auth.session.js';
import { hashSessionToken } from '../auth/auth.crypto.js';
import { ApiError } from '../common/errors.js';
import { z } from 'zod';

const emptyQuery = z.object({}).strict();
const kitchenWrites = new Set([
  'PUT /api/kitchen/session',
  'PATCH /api/kitchen/session/active',
  'DELETE /api/kitchen/session',
  'POST /api/kitchen/session/complete',
  'POST /api/recipes',
  'PUT /api/recipes/:id',
  'DELETE /api/recipes/:id',
  'POST /api/recipes/import',
]);

export function registerKitchenEvents(app: FastifyInstance) {
  const clients = new Set<{
    userId: number;
    tokenHash: string;
    send: (type: KitchenEvent['type']) => void;
    close: () => void;
  }>();

  app.get('/api/kitchen/events', async (request, reply: FastifyReply) => {
    emptyQuery.parse(request.query);
    const userId = authenticatedUser(request).id;
    const token = sessionToken(request);
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');
    if ([...clients].filter((client) => client.userId === userId).length >= 6) {
      throw new ApiError(429, 'KITCHEN_CONNECTION_LIMIT', '厨房连接过多，请关闭其他厨房页面后重试');
    }

    const cleanup = () => {
      clearInterval(heartbeat);
      clearTimeout(expiry);
      clients.delete(client);
    };
    const write = (data: string) => {
      if (!reply.raw.write(data)) {
        cleanup();
        reply.raw.destroy();
      }
    };
    const client = {
      userId,
      tokenHash: hashSessionToken(token),
      send(type: KitchenEvent['type']) {
        write(`data: ${JSON.stringify(KitchenEventSchema.parse({ type }))}\n\n`);
      },
      close() {
        cleanup();
        reply.raw.end();
      },
    };
    clients.add(client);
    reply.hijack();
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.on('close', cleanup);
    reply.raw.on('error', (error) => {
      request.log.warn({ err: error }, '厨房实时连接已中断');
      cleanup();
    });
    const heartbeat = setInterval(() => client.send('heartbeat'), 30_000);
    // 定期重新建立连接，让现有认证钩子复验持久会话。
    const expiry = setTimeout(() => {
      client.send('reconnect');
      client.close();
    }, 300_000);
    write('retry: 10000\n\n');
    client.send('ready');
  });

  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    const route = `${request.method} ${request.routeOptions.url}`;
    if (kitchenWrites.has(route) && request.authenticatedUser) {
      for (const client of clients) {
        if (client.userId === request.authenticatedUser.id) client.send('changed');
      }
    }
    if (
      route === 'DELETE /api/auth/session' ||
      route === 'POST /api/auth/login' ||
      route === 'POST /api/auth/register'
    ) {
      const token = sessionToken(request);
      if (!token) return;
      const tokenHash = hashSessionToken(token);
      for (const client of clients) {
        if (client.tokenHash === tokenHash) client.close();
      }
    }
  });
  app.addHook('preClose', async () => {
    for (const client of clients) client.close();
  });
}
