import { describe, expect, it } from 'vitest';
import {
  AuthCredentialsSchema,
  AuthResponseSchema,
  PasswordSchema,
  UsernameSchema,
  UpdateUsernameRequestSchema,
  UpdatePasswordRequestSchema,
  EmailSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
} from './auth.js';

describe('auth contract', () => {
  it('normalizes emails, supports both login identifiers and requires email only for new registration', () => {
    expect(EmailSchema.parse('ALICE@EXAMPLE.COM')).toBe('alice@example.com');
    expect(EmailSchema.safeParse(' alice@example.com').success).toBe(false);
    expect(
      LoginRequestSchema.parse({ username: 'ALICE@EXAMPLE.COM', password: 'password-123' })
        .username,
    ).toBe('alice@example.com');
    expect(
      LoginRequestSchema.safeParse({ username: 'Alice', password: 'password-123' }).success,
    ).toBe(true);
    expect(
      RegisterRequestSchema.safeParse({ username: 'Alice', password: 'password-123' }).success,
    ).toBe(false);
    expect(
      RegisterRequestSchema.safeParse({
        username: 'Alice',
        password: 'password-123',
        email: 'a@example.com',
        isSuperAdmin: true,
      }).success,
    ).toBe(false);
  });
  it('bounds admin pagination and never accepts internal user fields', () => {
    expect(AdminUsersQuerySchema.parse({})).toEqual({ page: 1 });
    expect(AdminUsersQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(AdminUsersQuerySchema.safeParse({ page: 1, userId: 1 }).success).toBe(false);
    expect(
      AdminUsersResponseSchema.safeParse({
        items: [
          {
            id: 1,
            username: 'sku',
            email: null,
            createdAt: '2026-10-11T00:00:00Z',
            passwordHash: 'secret',
          },
        ],
        page: 1,
        hasMore: false,
      }).success,
    ).toBe(false);
  });
  it('defines separate strict username and password updates', () => {
    expect(UpdateUsernameRequestSchema.parse({ username: 'Alice' })).toEqual({ username: 'Alice' });
    expect(UpdateUsernameRequestSchema.safeParse({ username: 'ab' }).success).toBe(false);
    expect(UpdateUsernameRequestSchema.safeParse({ username: 'Alice', userId: 9 }).success).toBe(
      false,
    );
    const input = { currentPassword: ' old-pass ', newPassword: ' new-pass ' };
    expect(UpdatePasswordRequestSchema.parse(input)).toEqual(input);
    expect(UpdatePasswordRequestSchema.safeParse({ ...input, userId: 9 }).success).toBe(false);
    expect(UpdatePasswordRequestSchema.safeParse({ ...input, newPassword: 'short' }).success).toBe(
      false,
    );
    expect(UpdatePasswordRequestSchema.safeParse({ ...input, currentPassword: '' }).success).toBe(
      false,
    );
  });
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
