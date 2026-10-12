import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';

describe('takeout candidate routes', () => {
  let app: ReturnType<typeof buildApp>;
  const cookie = `sku_session=${'a'.repeat(64)}`;
  const now = new Date('2026-10-12T00:00:00.000Z');

  function candidate(id: number, userId = 7) {
    return {
      id,
      userId,
      name: `店铺${id}`,
      url: `https://food.example.com/share/${id}`,
      urlHash: `${id}`.padStart(64, '0'),
      createdAt: now,
      updatedAt: now,
    };
  }

  function useUser(id: number) {
    vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue({
      tokenHash: '0'.repeat(64),
      userId: id,
      createdAt: now,
      ...{ user: { id, username: `User${id}` } },
    });
  }

  function useInteractiveTransactions() {
    return vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Expected interactive transaction');
      return operation(app.prisma);
    });
  }

  beforeEach(async () => {
    app = buildApp('postgresql://localhost/test', { logger: false });
    useUser(7);
    await app.ready();
  });

  afterEach(async () => app.close());

  it('requires authentication and rejects unknown fields without touching candidates', async () => {
    const lookup = vi.spyOn(app.prisma.takeoutCandidate, 'findMany');
    await request(app.server).get('/api/takeout/candidates').expect(401);
    await request(app.server)
      .post('/api/takeout/candidates')
      .set('Cookie', cookie)
      .send({ name: '店铺', url: 'https://food.example.com', userId: 99 })
      .expect(400);
    await request(app.server)
      .get('/api/takeout/random?userId=99')
      .set('Cookie', cookie)
      .expect(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('lists only the authenticated user and hides persistence-only fields', async () => {
    useUser(23);
    const lookup = vi
      .spyOn(app.prisma.takeoutCandidate, 'findMany')
      .mockResolvedValue([candidate(9, 23)]);

    const response = await request(app.server)
      .get('/api/takeout/candidates')
      .set('Cookie', cookie)
      .expect(200);

    expect(lookup).toHaveBeenCalledWith({
      where: { userId: 23 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(response.body.items[0]).toEqual({
      id: 9,
      name: '店铺9',
      url: 'https://food.example.com/share/9',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(JSON.stringify(response.body)).not.toMatch(/userId|urlHash/);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('creates with server-derived ownership and a URL hash inside the user lock', async () => {
    useInteractiveTransactions();
    vi.spyOn(app.prisma, '$queryRaw').mockResolvedValue([]);
    vi.spyOn(app.prisma.takeoutCandidate, 'findFirst').mockResolvedValue(null);
    const create = vi.spyOn(app.prisma.takeoutCandidate, 'create').mockResolvedValue(candidate(11));

    const response = await request(app.server)
      .post('/api/takeout/candidates')
      .set('Cookie', cookie)
      .send({ name: '  店铺A ', url: ' https://food.example.com/a ' })
      .expect(201);

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        name: '店铺A',
        url: 'https://food.example.com/a',
        urlHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(response.body.candidate.id).toBe(11);
  });

  it('rejects links duplicated within an import before writing any rows', async () => {
    useInteractiveTransactions();
    vi.spyOn(app.prisma, '$queryRaw').mockResolvedValue([]);
    const existingLookup = vi.spyOn(app.prisma.takeoutCandidate, 'findMany');
    const createMany = vi.spyOn(app.prisma.takeoutCandidate, 'createMany');

    const response = await request(app.server)
      .post('/api/takeout/candidates/import')
      .set('Cookie', cookie)
      .send({
        version: 1,
        candidates: [
          { name: '饭一', url: 'https://food.example.com/share/same' },
          { name: '饭二', url: 'https://food.example.com/share/same' },
        ],
      })
      .expect(422);

    expect(response.body.error.code).toBe('TAKEOUT_IMPORT_VALIDATION_FAILED');
    expect(response.body.error.issues).toEqual([
      expect.objectContaining({ path: ['candidates', 1, 'url'] }),
    ]);
    expect(existingLookup).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('rejects existing links atomically, then imports validated candidates in one batch', async () => {
    useInteractiveTransactions();
    vi.spyOn(app.prisma, '$queryRaw').mockResolvedValue([]);
    const existingUrlHash = createHash('sha256')
      .update('https://food.example.com/used')
      .digest('hex');
    const lookup = vi
      .spyOn(app.prisma.takeoutCandidate, 'findMany')
      .mockResolvedValue([{ ...candidate(1), urlHash: existingUrlHash }]);
    const createMany = vi.spyOn(app.prisma.takeoutCandidate, 'createMany').mockResolvedValue({
      count: 2,
    });

    const conflict = await request(app.server)
      .post('/api/takeout/candidates/import')
      .set('Cookie', cookie)
      .send({
        version: 1,
        candidates: [{ name: '已存在', url: 'https://food.example.com/used' }],
      })
      .expect(422);
    expect(conflict.body.error.code).toBe('TAKEOUT_IMPORT_VALIDATION_FAILED');
    expect(createMany).not.toHaveBeenCalled();

    lookup.mockResolvedValueOnce([]);
    const imported = await request(app.server)
      .post('/api/takeout/candidates/import')
      .set('Cookie', cookie)
      .send({
        version: 1,
        candidates: [
          { name: '饭一', url: 'https://food.example.com/1' },
          { name: '饭二', url: 'https://food.example.com/2' },
        ],
      })
      .expect(200);
    expect(imported.body).toEqual({ importedCount: 2 });
    expect(createMany).toHaveBeenCalledOnce();
    const call = createMany.mock.calls[0];
    if (!call) throw new Error('Import did not call createMany');
    expect(call[0]?.data).toHaveLength(2);
  });

  it('distinguishes an empty pool from a one-item pool with no alternative', async () => {
    const lookup = vi.spyOn(app.prisma.takeoutCandidate, 'findMany').mockResolvedValue([]);
    const empty = await request(app.server)
      .get('/api/takeout/random')
      .set('Cookie', cookie)
      .expect(200);
    expect(empty.body).toEqual({ candidate: null, reason: 'EMPTY_LIBRARY' });

    lookup.mockResolvedValueOnce([candidate(5)]);
    const alone = await request(app.server)
      .get('/api/takeout/random?excludeCandidateId=5')
      .set('Cookie', cookie)
      .expect(200);
    expect(alone.body).toEqual({ candidate: null, reason: 'NO_ALTERNATIVE' });
  });

  it('returns 404 when updating or deleting another user’s candidate', async () => {
    useInteractiveTransactions();
    vi.spyOn(app.prisma, '$queryRaw').mockResolvedValue([]);
    vi.spyOn(app.prisma.takeoutCandidate, 'findFirst').mockResolvedValue(null);
    const update = vi.spyOn(app.prisma.takeoutCandidate, 'update');
    const remove = vi
      .spyOn(app.prisma.takeoutCandidate, 'deleteMany')
      .mockResolvedValue({ count: 0 });

    await request(app.server)
      .put('/api/takeout/candidates/45')
      .set('Cookie', cookie)
      .send({ name: '修改', url: 'https://food.example.com/45' })
      .expect(404);
    await request(app.server)
      .delete('/api/takeout/candidates/45')
      .set('Cookie', cookie)
      .expect(404);

    expect(update).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ where: { id: 45, userId: 7 } });
  });
});
