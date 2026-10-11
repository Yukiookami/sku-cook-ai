import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { readKitchenState } from '../kitchen/kitchen.service.js';

describe('authenticated business scope (mock DB, transaction behavior requires real DB acceptance)', () => {
  let app: ReturnType<typeof buildApp>;
  let userId: number;
  const identity = { id: 7, username: 'User7' };
  let http: ReturnType<typeof request.agent>;
  const input = {
    title: '测试菜',
    ingredients: [{ name: '盐' }],
    steps: [{ order: 1, text: '调味' }],
  };
  beforeEach(() => {
    userId = 7;
    identity.id = 7;
    identity.username = 'User7';
    app = buildApp('postgresql://localhost/test');
    const authSession = {
      tokenHash: '0'.repeat(64),
      userId,
      createdAt: new Date(),
      user: identity,
    };
    vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue(authSession);
    vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Unexpected batch transaction');
      return operation(app.prisma);
    });
    vi.spyOn(app.prisma, '$queryRaw').mockResolvedValue([]);
    http = request.agent(app.server).set('Cookie', `sku_session=${'a'.repeat(64)}`);
  });
  afterEach(async () => app.close());

  it('scopes lists, random, export, tags and import prevalidation to each authenticated user', async () => {
    const recipes = vi.spyOn(app.prisma.recipe, 'findMany').mockResolvedValue([]);
    const tags = vi.spyOn(app.prisma.recipeTag, 'findMany').mockResolvedValue([]);
    await app.ready();
    for (const id of [7, 8]) {
      userId = id;
      identity.id = id;
      identity.username = `User${id}`;
      for (const path of ['/api/recipes', '/api/recipes/random', '/api/recipes/export']) {
        await http.get(path).expect(200);
        expect(recipes).toHaveBeenLastCalledWith(
          expect.objectContaining({ where: { userId: id } }),
        );
      }
      await http.get('/api/recipes/tags').expect(200);
      expect(tags).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { recipe: { userId: id } },
        }),
      );
      await http
        .post('/api/recipes/import/validate')
        .send({ version: 1, recipes: [input] })
        .expect(200);
      expect(recipes).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { userId: id, title: { in: [input.title] } },
        }),
      );
    }
  });

  it('treats inaccessible recipe/history ids as 404 and does not mutate them', async () => {
    const lookup = vi.spyOn(app.prisma.recipe, 'findFirst').mockResolvedValue(null);
    const history = vi.spyOn(app.prisma.cookingHistory, 'findFirst').mockResolvedValue(null);
    const update = vi.spyOn(app.prisma.recipe, 'update');
    const remove = vi.spyOn(app.prisma.recipe, 'delete');
    await app.ready();
    await http.get('/api/recipes/99').expect(404);
    await http.put('/api/recipes/99').send(input).expect(404);
    await http.delete('/api/recipes/99').expect(404);
    expect(lookup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 99, userId: 7 },
      }),
    );
    await http.post('/api/cooking-history').send({ recipeId: 99, targetServings: 1 }).expect(404);
    await http.delete('/api/cooking-history/99').expect(404);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 99, userId: 7 } }));
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(app.prisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 7);
  });

  it('scopes history and kitchen snapshots and rejects foreign recipes before kitchen writes', async () => {
    const history = vi.spyOn(app.prisma.cookingHistory, 'findMany').mockResolvedValue([]);
    const kitchen = vi.spyOn(app.prisma.kitchenSession, 'findUnique').mockResolvedValue(null);
    const recipes = vi.spyOn(app.prisma.recipe, 'findMany').mockResolvedValue([]);
    const create = vi.spyOn(app.prisma.kitchenSession, 'create');
    await app.ready();
    for (const id of [7, 8]) {
      userId = id;
      identity.id = id;
      identity.username = `User${id}`;
      await http.get('/api/cooking-history').expect(200);
      expect(history).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: id } }));
      const state = await http.get('/api/kitchen/session').expect(200);
      expect(state.body.session.recipeIds).toEqual([]);
      expect(kitchen).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: id } }));
    }
    await http
      .put('/api/kitchen/session')
      .send({ expectedRevision: 0, items: [{ recipeId: 99, targetServings: 1 }] })
      .expect(404);
    expect(recipes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 8, id: { in: [99] } },
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects stale revisions before mutations and checks snapshot ownership in the same transaction', async () => {
    const date = new Date();
    const recipe = {
      id: 99,
      userId: 8,
      title: '其他用户的菜',
      description: null,
      servings: 1,
      prepMinutes: null,
      cookMinutes: null,
      difficulty: null,
      tips: null,
      source: null,
      createdAt: date,
      updatedAt: date,
      ingredients: [],
      steps: [],
      tags: [],
    };
    const stored = {
      id: 1,
      userId: 7,
      revision: 2,
      activeRecipeId: 99,
      updatedAt: date,
      items: [{ id: 1, kitchenSessionId: 1, recipeId: 99, position: 0, targetServings: 1, recipe }],
    };
    vi.spyOn(app.prisma.kitchenSession, 'findUnique').mockResolvedValue(stored);
    const update = vi.spyOn(app.prisma.kitchenSession, 'update');
    const createHistory = vi.spyOn(app.prisma.cookingHistory, 'create');
    await app.ready();
    await http
      .put('/api/kitchen/session')
      .send({
        expectedRevision: 1,
        items: [{ recipeId: 99, targetServings: 1 }],
      })
      .expect(409);
    await http.post('/api/kitchen/session/complete').send({ expectedRevision: 2 }).expect(500);
    await expect(readKitchenState(app.prisma, app, 7)).rejects.toThrow('outside its owner scope');
    expect(update).not.toHaveBeenCalled();
    expect(createHistory).not.toHaveBeenCalled();
  });
});
