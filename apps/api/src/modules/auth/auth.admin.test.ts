import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { hashPassword } from './auth.crypto.js';

describe('email login and read-only administration', () => {
  let app: ReturnType<typeof buildApp>;
  const cookie = `sku_session=${'a'.repeat(64)}`;
  const user = { id: 1, username: 'sku', email: 'admin@example.com', isSuperAdmin: true };
  beforeEach(async () => {
    app = buildApp('postgresql://localhost/test', { logger: false });
    const session = {
      user,
      userId: 1,
      tokenHash: '',
      createdAt: new Date(),
    };
    vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue(session);
    await app.ready();
  });
  afterEach(async () => app.close());

  it('requires authentication and rejects ordinary users before listing anything', async () => {
    const list = vi.spyOn(app.prisma.user, 'findMany');
    await request(app.server).get('/api/admin/users').expect(401);
    const ordinarySession = {
      user: { ...user, isSuperAdmin: false },
      userId: 1,
      tokenHash: '',
      createdAt: new Date(),
    };
    vi.mocked(app.prisma.authSession.findUnique).mockResolvedValue(ordinarySession);
    const denied = await request(app.server)
      .get('/api/admin/users')
      .set('Cookie', cookie)
      .expect(403);
    expect(denied.body.error.code).toBe('ADMIN_REQUIRED');
    expect(list).not.toHaveBeenCalled();
  });

  it('returns only safe fields with bounded stable pagination and fresh server-side privileges', async () => {
    const createdAt = new Date('2026-10-11T00:00:00.000Z');
    const list = vi.spyOn(app.prisma.user, 'findMany').mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({
        ...user,
        id: i + 1,
        name: 'sku',
        usernameKey: 'sku',
        passwordHash: 'private-hash',
        createdAt,
        updatedAt: createdAt,
      })),
    );
    const response = await request(app.server)
      .get('/api/admin/users?page=2')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body.items).toHaveLength(20);
    expect(response.body.hasMore).toBe(true);
    expect(response.body.page).toBe(2);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|private-hash|usernameKey|isSuperAdmin/,
    );
    expect(list).toHaveBeenCalledWith({
      skip: 20,
      take: 21,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, username: true, email: true, createdAt: true },
    });
    await request(app.server).get('/api/admin/users?page=0').set('Cookie', cookie).expect(400);
    await request(app.server).get('/api/admin/users?userId=1').set('Cookie', cookie).expect(400);
  });

  it('logs in by a case-insensitive email without changing username-based login', async () => {
    const password = 'current-password';
    const record = {
      ...user,
      name: 'sku',
      usernameKey: 'sku',
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const lookup = vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(record);
    vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Expected interactive transaction');
      return operation(app.prisma);
    });
    vi.spyOn(app.prisma.authSession, 'create').mockResolvedValue({
      userId: 1,
      tokenHash: '',
      createdAt: new Date(),
    });
    const response = await request(app.server)
      .post('/api/auth/login')
      .send({ username: 'ADMIN@EXAMPLE.COM', password })
      .expect(200);
    expect(lookup).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
    expect(response.body).toEqual({ user });
    await request(app.server)
      .post('/api/auth/login')
      .send({ username: 'SKU', password })
      .expect(200);
    expect(lookup).toHaveBeenLastCalledWith({ where: { usernameKey: 'sku' } });
  });

  it('requires an email on registration, rejects privilege injection, and maps only email conflicts', async () => {
    const create = vi.spyOn(app.prisma.user, 'create');
    await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', password: 'password-123' })
      .expect(400);
    await request(app.server)
      .post('/api/auth/register')
      .send({
        username: 'Alice',
        email: 'alice@example.com',
        password: 'password-123',
        isSuperAdmin: true,
      })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
    vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Expected interactive transaction');
      return operation(app.prisma);
    });
    create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
    const response = await request(app.server)
      .post('/api/auth/register')
      .send({ username: 'Alice', email: 'ALICE@EXAMPLE.COM', password: 'password-123' })
      .expect(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'alice@example.com' }),
      }),
    );
  });
});
