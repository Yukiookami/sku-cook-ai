import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';

describe('recipe heart contract (mock database)', () => {
  let app: ReturnType<typeof buildApp>;
  const cookie = `sku_session=${'a'.repeat(64)}`;
  beforeEach(async () => {
    app = buildApp('postgresql://localhost/test');
    const session = {
      user: { id: 7, username: 'Alice' },
      userId: 7,
      tokenHash: '',
      createdAt: new Date(),
    };
    vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue(session);
    await app.ready();
  });
  afterEach(async () => app.close());

  it('requires authentication and strictly validates target state, id, and query before writes', async () => {
    const update = vi.spyOn(app.prisma, '$executeRaw');
    await request(app.server).put('/api/recipes/11/like').send({ isLiked: true }).expect(401);
    for (const body of [{}, { isLiked: 'true' }, { isLiked: true, userId: 99 }]) {
      await request(app.server)
        .put('/api/recipes/11/like')
        .set('Cookie', cookie)
        .send(body)
        .expect(400);
    }
    await request(app.server)
      .put('/api/recipes/0/like')
      .set('Cookie', cookie)
      .send({ isLiked: true })
      .expect(400);
    await request(app.server)
      .put('/api/recipes/11/like?userId=99')
      .set('Cookie', cookie)
      .send({ isLiked: true })
      .expect(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('sets an explicit state idempotently within the authenticated owner and preserves updated_at', async () => {
    const update = vi.spyOn(app.prisma, '$executeRaw').mockResolvedValue(1);
    for (const isLiked of [true, true, false]) {
      const response = await request(app.server)
        .put('/api/recipes/11/like')
        .set('Cookie', cookie)
        .send({ isLiked })
        .expect(200);
      expect(response.body).toEqual({ id: 11, isLiked });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    const [sql, target, id, owner] = update.mock.calls[0]!;
    const query = 'join' in sql ? sql.join('') : sql.sql;
    expect(query).toContain('WHERE id =');
    expect(query).not.toContain('updated_at');
    expect([target, id, owner]).toEqual([true, 11, 7]);
  });

  it('treats missing or other-owner recipes as 404 and reports storage failures without fake success', async () => {
    vi.spyOn(app.prisma, '$executeRaw')
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce({ code: 'P1001' });
    await request(app.server)
      .put('/api/recipes/11/like')
      .set('Cookie', cookie)
      .send({ isLiked: true })
      .expect(404);
    const failed = await request(app.server)
      .put('/api/recipes/11/like')
      .set('Cookie', cookie)
      .send({ isLiked: true })
      .expect(503);
    expect(failed.body).not.toHaveProperty('isLiked');
    await request(app.server)
      .put('/api/recipes/11/like')
      .set('Cookie', cookie)
      .set('Origin', 'https://other.example')
      .send({ isLiked: true })
      .expect(403);
  });
});
