import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('recipe route boundary validation (database not exercised)', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp('postgresql://localhost/test');
  });
  afterEach(async () => app.close());

  it('rejects unknown query fields at the static tags route without querying data', async () => {
    await app.ready();
    const response = await request(app.server).get('/api/recipes/tags?unknown=1').expect(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(response.body.error.issues[0].message).toContain('unknown');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejects invalid ids and unknown write fields before database access', async () => {
    await app.ready();
    const invalidId = await request(app.server).get('/api/recipes/0').expect(400);
    expect(invalidId.body.error.code).toBe('INVALID_INPUT');

    const unknownField = await request(app.server)
      .post('/api/recipes')
      .send({
        title: '菜',
        userId: 99,
        ingredients: [{ name: '盐' }],
        steps: [{ order: 1, text: '做' }],
      })
      .expect(400);
    expect(unknownField.body.error.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(unknownField.body)).not.toContain('99');
  });

  it('rejects random-query and import-envelope errors before database access', async () => {
    await app.ready();
    const random = await request(app.server)
      .get('/api/recipes/random?excludeRecipeId=0')
      .expect(400);
    expect(random.body.error.code).toBe('INVALID_INPUT');

    const invalidImport = await request(app.server)
      .post('/api/recipes/import/validate')
      .send({ version: 2, recipes: [{ title: '' }] })
      .expect(422);
    expect(invalidImport.body.error.code).toBe('IMPORT_VALIDATION_FAILED');
    expect(invalidImport.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['version'] })]),
    );
    expect(invalidImport.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['recipes', 0, 'title'] })]),
    );
  });

  it('rejects unknown kitchen and history input fields before database access', async () => {
    await app.ready();
    const kitchen = await request(app.server)
      .put('/api/kitchen/session')
      .send({ items: [], expectedRevision: 0, userId: 1 })
      .expect(400);
    expect(kitchen.body.error.code).toBe('INVALID_INPUT');

    const history = await request(app.server)
      .post('/api/cooking-history')
      .send({ recipeId: 1, targetServings: 2, source: 'client' })
      .expect(400);
    expect(history.body.error.code).toBe('INVALID_INPUT');
  });
});
