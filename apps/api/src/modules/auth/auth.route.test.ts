import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { hashPassword, hashSessionToken } from './auth.crypto.js';

describe('auth HTTP contract (mock database, not integration acceptance)', () => {
  let app: ReturnType<typeof buildApp>;
  let password: string;
  beforeEach(() => {
    password = randomBytes(24).toString('base64url');
    app = buildApp('postgresql://localhost/test', { logger: false }, { secureCookie: true });
  });
  afterEach(async () => app.close());

  function mockTransaction() {
    return vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Unexpected batch transaction');
      return operation(app.prisma);
    });
  }

  it.each([
    ['get', '/api/recipes'],
    ['get', '/api/recipes/tags'],
    ['get', '/api/recipes/export'],
    ['get', '/api/recipes/1'],
    ['get', '/api/recipes/random'],
    ['post', '/api/recipes'],
    ['put', '/api/recipes/1'],
    ['delete', '/api/recipes/1'],
    ['post', '/api/recipes/import'],
    ['post', '/api/recipes/import/validate'],
    ['get', '/api/kitchen/session'],
    ['put', '/api/kitchen/session'],
    ['patch', '/api/kitchen/session/active'],
    ['delete', '/api/kitchen/session'],
    ['post', '/api/kitchen/session/complete'],
    ['get', '/api/cooking-history'],
    ['post', '/api/cooking-history'],
    ['delete', '/api/cooking-history/1'],
    ['get', '/api/auth/session'],
    ['patch', '/api/auth/username'],
    ['put', '/api/auth/password'],
    ['get', '/api/health-extra'],
  ] as const)('requires authentication for %s %s before any DB operation', async (method, path) => {
    const lookup = vi.spyOn(app.prisma.authSession, 'findUnique');
    await app.ready();
    const response = await request(app.server)[method](path).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('validates credential limits, query and unknown fields without leaking the password', async () => {
    await app.ready();
    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password, userId: 1 })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(response.body)).not.toContain(password);
    await request(app.server)
      .post('/api/auth/login?extra=1')
      .send({ username: 'Alice', password })
      .expect(400);
    await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password: 'x'.repeat(5000) })
      .expect(413);
  });

  it('registers user and session atomically; only hashes reach the database', async () => {
    const transaction = mockTransaction();
    const createUser = vi.spyOn(app.prisma.user, 'create').mockResolvedValue({
      id: 9,
      name: 'Alice',
      username: 'Alice',
      usernameKey: 'alice',
      email: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const createSession = vi.spyOn(app.prisma.authSession, 'create').mockResolvedValue({
      userId: 9,
      tokenHash: '',
      createdAt: new Date(),
    });
    await app.ready();
    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password })
      .expect(201);
    expect(response.body).toEqual({ user: { id: 9, username: 'Alice' } });
    const cookie = String(response.headers['set-cookie'][0]);
    const token = cookie.split(';')[0].split('=')[1];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=315360000');
    expect(createSession).toHaveBeenCalledWith({
      data: { userId: 9, tokenHash: hashSessionToken(token) },
    });
    expect(JSON.stringify(createUser.mock.calls)).not.toContain(password);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('maps only username uniqueness conflicts, not unrelated storage failures', async () => {
    mockTransaction();
    vi.spyOn(app.prisma.user, 'create')
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['username_key'] } })
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['token_hash'] } });
    await app.ready();
    const conflict = await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'aLiCe', password })
      .expect(409);
    expect(conflict.body.error.code).toBe('USERNAME_TAKEN');
    await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password })
      .expect(500);
  });

  it('logs in case-insensitively and replaces/revokes the browser previous token', async () => {
    mockTransaction();
    const lookup = vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({
      id: 9,
      name: 'Alice',
      username: 'Alice',
      usernameKey: 'alice',
      email: null,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(app.prisma.authSession, 'create').mockResolvedValue({
      userId: 9,
      tokenHash: '',
      createdAt: new Date(),
    });
    const revoke = vi.spyOn(app.prisma.authSession, 'deleteMany').mockResolvedValue({ count: 1 });
    await app.ready();
    const previous = 'a'.repeat(64);
    const response = await request(app.server)
      .post('/api/auth/login')
      .set('Cookie', `sku_session=${previous}`)
      .send({ username: 'aLiCe', password })
      .expect(200);
    expect(response.body).toEqual({ user: { id: 9, username: 'Alice' } });
    expect(lookup).toHaveBeenCalledWith({ where: { usernameKey: 'alice' } });
    expect(revoke).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken(previous) } });
  });

  it('returns the same credential error for missing users, bad passwords and uninitialized legacy users', async () => {
    const lookup = vi
      .spyOn(app.prisma.user, 'findUnique')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1,
        name: 'default-user',
        username: 'Sku001',
        usernameKey: 'sku001',
        email: null,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 1,
        name: 'default-user',
        username: 'Sku001',
        usernameKey: 'sku001',
        email: null,
        passwordHash: await hashPassword(randomBytes(24).toString('hex')),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await app.ready();
    for (let index = 0; index < 3; index++) {
      const response = await request(app.server)
        .post('/api/auth/login')
        .send({ username: 'Sku001', password })
        .expect(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('accepts an old persisted session without an expiry check, renews cookie, then revokes on logout', async () => {
    const token = 'a'.repeat(64);
    const lookup = vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue({
      userId: 9,
      tokenHash: hashSessionToken(token),
      createdAt: new Date('2020-01-01'),
      ...{ user: { id: 9, username: 'Alice' } },
    });
    const revoke = vi.spyOn(app.prisma.authSession, 'deleteMany').mockResolvedValue({ count: 1 });
    await app.ready();
    const current = await request(app.server)
      .get('/api/auth/session')
      .set('Cookie', `sku_session=${token}`)
      .expect(200);
    expect(current.body).toEqual({ user: { id: 9, username: 'Alice' } });
    expect(current.headers['set-cookie'][0]).toContain('Max-Age=315360000');
    const logout = await request(app.server)
      .delete('/api/auth/session')
      .set('Cookie', `sku_session=${token}`)
      .expect(204);
    expect(logout.text).toBe('');
    expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(revoke).toHaveBeenCalledWith({ where: { tokenHash: hashSessionToken(token) } });
    lookup.mockResolvedValue(null);
    const expired = await request(app.server)
      .get('/api/auth/session')
      .set('Cookie', `sku_session=${token}`)
      .expect(401);
    expect(expired.headers['set-cookie'][0]).toContain('Max-Age=0');
    await request(app.server).delete('/api/auth/session').expect(204);
  });

  it('rejects malformed cookies and browser cross-site writes and login CSRF', async () => {
    await app.ready();
    await request(app.server).get('/api/auth/session').set('Cookie', 'sku_session=bad').expect(401);
    await request(app.server)
      .post('/api/auth/login')
      .set('Origin', 'https://other.example')
      .send({ username: 'Alice', password })
      .expect(403);
    await request(app.server)
      .delete('/api/auth/session')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('keeps database failure distinct from unauthenticated and never returns fake session data', async () => {
    vi.spyOn(app.prisma.authSession, 'findUnique').mockRejectedValue({ code: 'P1001' });
    await app.ready();
    const response = await request(app.server)
      .get('/api/auth/session')
      .set('Cookie', `sku_session=${'a'.repeat(64)}`)
      .expect(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('never issues a cookie when the transactional session creation fails', async () => {
    const transaction = mockTransaction();
    vi.spyOn(app.prisma.user, 'create').mockResolvedValue({
      id: 9,
      name: 'Alice',
      username: 'Alice',
      usernameKey: 'alice',
      email: null,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(app.prisma.authSession, 'create').mockRejectedValue(
      new Error('private storage error'),
    );
    await app.ready();
    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password })
      .expect(500);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(transaction).toHaveBeenCalledOnce();
    expect(JSON.stringify(response.body)).not.toContain('private storage error');
  });

  it('does not pretend logout succeeded or clear the cookie when revocation fails', async () => {
    vi.spyOn(app.prisma.authSession, 'deleteMany').mockRejectedValue({ code: 'P1001' });
    await app.ready();
    const response = await request(app.server)
      .delete('/api/auth/session')
      .set('Cookie', `sku_session=${'a'.repeat(64)}`)
      .expect(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
