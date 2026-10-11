import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from './auth.crypto.js';

describe('auth cryptography', () => {
  it('uses independently salted scrypt and rejects invalid or missing hashes', async () => {
    const password = randomBytes(24).toString('base64url');
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(`${password}x`, first)).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
    expect(await verifyPassword(password, 'invalid')).toBe(false);
  });
  it('generates opaque random tokens and stores a distinct SHA-256 digest', () => {
    const token = newSessionToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(newSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
