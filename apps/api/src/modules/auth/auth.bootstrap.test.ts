import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapUser } from './auth.bootstrap.js';
import { verifyPassword } from './auth.crypto.js';

describe('bootstrap seed (mock DB; real seed idempotency not accepted)', () => {
  const prisma = new PrismaClient({ datasourceUrl: 'postgresql://localhost/test' });
  afterEach(() => vi.restoreAllMocks());

  it('rejects missing configuration without any write or sensitive input in errors', async () => {
    const tx = vi.spyOn(prisma, '$transaction');
    await expect(bootstrapUser(prisma, undefined)).rejects.toThrow('BOOTSTRAP_USER_PASSWORD');
    await expect(bootstrapUser(prisma, 'x'.repeat(7))).rejects.toThrow('8–128');
    expect(tx).not.toHaveBeenCalled();
  });
  it('retains existing user fields and only initializes a null hash; repeated seed never overwrites a password', async () => {
    const password = '12345678';
    vi.spyOn(prisma, '$transaction').mockImplementation(async (operation) => {
      if (typeof operation !== 'function') throw new Error('Unexpected batch transaction');
      return operation(prisma);
    });
    const upsert = vi.spyOn(prisma.user, 'upsert').mockResolvedValue({
      id: 1,
      name: '原来的名字',
      username: 'Sku001',
      usernameKey: 'sku001',
      email: null,
      isSuperAdmin: false,
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const update = vi.spyOn(prisma.user, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
    vi.spyOn(prisma, '$executeRaw').mockResolvedValue(0);
    await bootstrapUser(prisma, password);
    update.mockResolvedValue({ count: 0 });
    await bootstrapUser(prisma, randomBytes(24).toString('hex'));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 }, update: {} }));
    for (const [args] of update.mock.calls) {
      expect(args?.where).toEqual({ id: 1, passwordHash: null });
    }
    const firstHash = update.mock.calls[0][0]?.data.passwordHash;
    expect(typeof firstHash).toBe('string');
    if (typeof firstHash !== 'string') throw new Error('Expected hash string');
    expect(await verifyPassword(password, firstHash)).toBe(true);
    expect(JSON.stringify(upsert.mock.calls)).not.toContain(password);
  });
});
