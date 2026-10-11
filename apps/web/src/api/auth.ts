import {
  LoginRequestSchema,
  RegisterRequestSchema,
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
  AuthResponseSchema,
  UpdateUsernameRequestSchema,
  UpdateUsernameResponseSchema,
  UpdatePasswordRequestSchema,
  UpdatePasswordResponseSchema,
  type AuthUser,
  type UpdatePasswordRequest,
} from '@sku-cook/shared';
import { client } from './client';

export type AccountUser = AuthUser;

export async function updateAccountUsername(username: string): Promise<AccountUser> {
  const { data } = await client.patch<unknown>(
    '/auth/username',
    UpdateUsernameRequestSchema.parse({ username }),
  );
  return UpdateUsernameResponseSchema.parse(data).user;
}

export async function updateAccountPassword(input: UpdatePasswordRequest): Promise<AccountUser> {
  const { data } = await client.put<unknown>(
    '/auth/password',
    UpdatePasswordRequestSchema.parse(input),
  );
  return UpdatePasswordResponseSchema.parse(data).user;
}

export function validateAccountCredentials(
  username: string,
  password: string,
  email?: string,
): string | null {
  const result =
    email === undefined
      ? LoginRequestSchema.safeParse({ username, password })
      : RegisterRequestSchema.safeParse({ username, password, email });
  return result.success ? null : (result.error.issues[0]?.message ?? '请检查账号信息。');
}

export async function loginAccount(username: string, password: string): Promise<AccountUser> {
  const body = LoginRequestSchema.parse({ username, password });
  const { data } = await client.post<unknown>('/auth/login', body);
  return AuthResponseSchema.parse(data).user;
}

export async function registerAccount(
  username: string,
  password: string,
  email: string,
): Promise<AccountUser> {
  const body = RegisterRequestSchema.parse({ username, password, email });
  const { data } = await client.post<unknown>('/auth/register', body);
  return AuthResponseSchema.parse(data).user;
}

export async function getAdminUsers(page: number) {
  const params = AdminUsersQuerySchema.parse({ page });
  const { data } = await client.get<unknown>('/admin/users', { params });
  return AdminUsersResponseSchema.parse(data);
}

export async function getAccountSession(): Promise<AccountUser> {
  const { data } = await client.get<unknown>('/auth/session');
  return AuthResponseSchema.parse(data).user;
}

export async function deleteAccountSession(): Promise<void> {
  const response = await client.delete<unknown>('/auth/session');
  if (response.status !== 204) {
    throw new Error('退出响应状态不符合约定。');
  }
}
