import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { hashPassword, verifyPassword } from './auth.crypto.js';

describe('user center HTTP contract (mock database only)', () => {
  let app: ReturnType<typeof buildApp>;
  const cookie = `sku_session=${'a'.repeat(64)}`;
  const user = { id: 42, username: 'Alice' };
  beforeEach(async () => {
    app = buildApp('postgresql://localhost/test', { logger: false });
    const session = {
      user,
      userId: user.id,
      tokenHash: '',
      createdAt: new Date(),
    };
    vi.spyOn(app.prisma.authSession, 'findUnique').mockResolvedValue(session);
    vi.spyOn(app.prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Unexpected batch transaction');
      return operation(app.prisma);
    });
    await app.ready();
  });
  afterEach(async () => app.close());

  it.each([
    ['patch', '/api/auth/username', { username: 'ab' }],
    ['patch', '/api/auth/username', { username: 'Bob', userId: 99 }],
    ['put', '/api/auth/password', { currentPassword: 'abcdefgh', newPassword: 'short' }],
    [
      'put',
      '/api/auth/password',
      { currentPassword: 'abcdefgh', newPassword: 'ijklmnop', userId: 99 },
    ],
  ] as const)('rejects invalid %s %s without writes', async (method, path, body) => {
    const update = vi.spyOn(app.prisma.user, 'update');
    const updateMany = vi.spyOn(app.prisma.user, 'updateMany');
    const agent = request(app.server);
    const response = await agent[method](path).set('Cookie', cookie).send(body).expect(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain('abcdefgh');
  });

  it('updates only the authenticated user and preserves the id/session', async () => {
    const update = vi.spyOn(app.prisma.user, 'update').mockResolvedValue({
      ...user,
      username: 'ALICE',
      name: 'ALICE',
      usernameKey: 'alice',
      passwordHash: null,
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const sessionDelete = vi.spyOn(app.prisma.authSession, 'deleteMany');
    const response = await request(app.server)
      .patch('/api/auth/username')
      .set('Cookie', cookie)
      .send({ username: 'ALICE' })
      .expect(200);
    expect(response.body).toEqual({ user: { id: 42, username: 'ALICE' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { username: 'ALICE', name: 'ALICE', usernameKey: 'alice' },
      select: { id: true, username: true },
    });
    expect(sessionDelete).not.toHaveBeenCalled();
  });

  it('maps the username unique constraint to 409 but not unrelated errors', async () => {
    vi.spyOn(app.prisma.user, 'update')
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['username_key'] } })
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['other'] } });
    const response = await request(app.server)
      .patch('/api/auth/username')
      .set('Cookie', cookie)
      .send({ username: 'Bob' })
      .expect(409);
    expect(response.body.error.code).toBe('USERNAME_TAKEN');
    await request(app.server)
      .patch('/api/auth/username')
      .set('Cookie', cookie)
      .send({ username: 'Bob' })
      .expect(500);
  });

  async function passwordRecord() {
    const passwordHash = await hashPassword('current-pass');
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({
      ...user,
      passwordHash,
      name: 'Alice',
      usernameKey: 'alice',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return passwordHash;
  }

  it('checks current password on the server without writes or credential leakage on failure', async () => {
    await passwordRecord();
    const update = vi.spyOn(app.prisma.user, 'updateMany');
    const response = await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrong-pass', newPassword: 'new-password' })
      .expect(400);
    expect(response.body.error.code).toBe('CURRENT_PASSWORD_INCORRECT');
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toMatch(/wrong-pass|new-password|scrypt/);
  });

  it('atomically replaces the verified hash, returns public user and retains all sessions', async () => {
    const oldHash = await passwordRecord();
    const update = vi.spyOn(app.prisma.user, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(app.prisma.user, 'findUniqueOrThrow').mockResolvedValue({
      ...user,
      passwordHash: '',
      name: 'Alice',
      usernameKey: 'alice',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const sessionDelete = vi.spyOn(app.prisma.authSession, 'deleteMany');
    const response = await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'current-pass', newPassword: 'new-password' })
      .expect(200);
    expect(response.body).toEqual({ user });
    const args = update.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ id: 42, passwordHash: oldHash });
    const hash = args?.data.passwordHash;
    expect(typeof hash).toBe('string');
    if (typeof hash !== 'string') throw new Error('Expected hash');
    expect(await verifyPassword('new-password', hash)).toBe(true);
    expect(await verifyPassword('current-pass', hash)).toBe(false);
    expect(sessionDelete).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(hash);
  });

  it('rejects a concurrent password replacement instead of overwriting it', async () => {
    await passwordRecord();
    vi.spyOn(app.prisma.user, 'updateMany').mockResolvedValue({ count: 0 });
    const read = vi.spyOn(app.prisma.user, 'findUniqueOrThrow');
    const response = await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'current-pass', newPassword: 'new-password' })
      .expect(409);
    expect(response.body.error.code).toBe('PASSWORD_CHANGED');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects query parameters and cross-site writes', async () => {
    await request(app.server)
      .patch('/api/auth/username?userId=99')
      .set('Cookie', cookie)
      .send({ username: 'Bob' })
      .expect(400);
    await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .set('Origin', 'https://other.invalid')
      .send({ currentPassword: 'current-pass', newPassword: 'new-password' })
      .expect(403);
  });

  it('rejects oversized bodies and maps database unavailability without credential disclosure', async () => {
    const oversized = await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'current-pass', newPassword: 'x'.repeat(5000) })
      .expect(413);
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue({ code: 'P1001' });
    const response = await request(app.server)
      .put('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'current-pass', newPassword: 'new-password' })
      .expect(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toMatch(/current-pass|new-password/);
  });
});
