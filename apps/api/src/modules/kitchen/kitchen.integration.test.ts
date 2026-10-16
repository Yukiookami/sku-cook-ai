import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { KitchenStateResponseSchema, RecipeResponseSchema } from '@sku-cook/shared';
import { buildApp } from '../../app.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !target.pathname.startsWith('/sku_cook_test_')
  ) {
    throw new Error('厨房集成测试仅允许本机 sku_cook_test_ 前缀的独立测试库');
  }
}

describe.skipIf(!databaseUrl)('kitchen real HTTP and PostgreSQL persistence', () => {
  it('persists a sent menu for a second device on the same account and rejects stale writes', async () => {
    if (!databaseUrl) throw new Error('请显式配置独立 TEST_DATABASE_URL');
    const app = buildApp(databaseUrl, { logger: false }, { secureCookie: false });
    try {
      await app.ready();
      const phone = request.agent(app.server);
      const kitchen = request.agent(app.server);
      const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
      const credentials = { username: `Kitchen${suffix}`, password: randomUUID() };
      const registered = await phone
        .post('/api/auth/register')
        .send({ ...credentials, email: `${suffix}@example.test` })
        .expect(201);
      await kitchen.post('/api/auth/login').send(credentials).expect(200);

      const created = await phone
        .post('/api/recipes')
        .send({
          title: '厨房链路测试菜',
          servings: 2,
          ingredients: [{ name: '鸡蛋', amount: '2', unit: '个' }],
          steps: [{ order: 1, text: '炒熟后盛出。' }],
        })
        .expect(201);
      const recipe = RecipeResponseSchema.parse(created.body).recipe;
      const before = KitchenStateResponseSchema.parse(
        (await kitchen.get('/api/kitchen/session').expect(200)).body,
      );
      expect(before.session.items).toEqual([]);

      const items = [{ recipeId: recipe.id, targetServings: 3 }];
      const sent = KitchenStateResponseSchema.parse(
        (
          await phone
            .put('/api/kitchen/session')
            .send({ items, expectedRevision: before.session.revision })
            .expect(200)
        ).body,
      );
      expect(sent.session.items).toEqual(items);
      expect(sent.session.revision).toBe(before.session.revision + 1);
      expect(sent.session.activeRecipeId).toBe(recipe.id);
      expect(sent.session.recipes[0]?.steps[0]?.text).toBe('炒熟后盛出。');

      const stored = await app.prisma.kitchenSession.findUniqueOrThrow({
        where: { userId: registered.body.user.id },
        include: { items: true },
      });
      expect(stored.revision).toBe(sent.session.revision);
      expect(stored.items).toEqual([
        expect.objectContaining({ recipeId: recipe.id, targetServings: 3 }),
      ]);
      const received = KitchenStateResponseSchema.parse(
        (await kitchen.get('/api/kitchen/session').expect(200)).body,
      );
      expect(received).toEqual(sent);

      await phone
        .put('/api/kitchen/session')
        .send({ items, expectedRevision: before.session.revision })
        .expect(409);
      const afterConflict = KitchenStateResponseSchema.parse(
        (await kitchen.get('/api/kitchen/session').expect(200)).body,
      );
      expect(afterConflict).toEqual(sent);
    } finally {
      await app.close();
    }
  });
});
