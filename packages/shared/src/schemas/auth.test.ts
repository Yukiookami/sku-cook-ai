import { describe, expect, it } from 'vitest';
import {
  AuthCredentialsSchema,
  AuthResponseSchema,
  PasswordSchema,
  UsernameSchema,
} from './auth.js';

describe('auth contract', () => {
  it('preserves username casing and password whitespace', () => {
    const password = ` ${'x'.repeat(8)} `;
    expect(AuthCredentialsSchema.parse({ username: 'Sku001', password })).toEqual({
      username: 'Sku001',
      password,
    });
  });
  it.each(['ab', '1abc', '用户', ' abc', 'abc ', 'a-b', 'a'.repeat(33)])(
    'rejects invalid username %s',
    (username) => {
      expect(UsernameSchema.safeParse(username).success).toBe(false);
    },
  );
  it('enforces password limits without requiring arbitrary character classes', () => {
    expect(PasswordSchema.safeParse('x'.repeat(7)).success).toBe(false);
    expect(PasswordSchema.safeParse('x'.repeat(8)).success).toBe(true);
    expect(PasswordSchema.safeParse(' '.repeat(8)).success).toBe(false);
    expect(PasswordSchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(PasswordSchema.safeParse('x'.repeat(128)).success).toBe(true);
  });
  it('rejects unknown request fields and private response fields', () => {
    expect(
      AuthCredentialsSchema.safeParse({
        username: 'Alice',
        password: 'x'.repeat(8),
        userId: 1,
      }).success,
    ).toBe(false);
    expect(
      AuthResponseSchema.safeParse({
        user: { id: 1, username: 'Sku001', passwordHash: 'private' },
      }).success,
    ).toBe(false);
    expect(AuthResponseSchema.parse({ user: { id: 1, username: 'Sku001' } })).toEqual({
      user: { id: 1, username: 'Sku001' },
    });
  });
});
