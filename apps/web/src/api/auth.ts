import {
  AuthCredentialsSchema,
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

export function validateAccountCredentials(username: string, password: string): string | null {
  const result = AuthCredentialsSchema.safeParse({ username, password });
  return result.success ? null : (result.error.issues[0]?.message ?? '请检查账号信息。');
}

export async function loginAccount(username: string, password: string): Promise<AccountUser> {
  const body = AuthCredentialsSchema.parse({ username, password });
  const { data } = await client.post<unknown>('/auth/login', body);
  return AuthResponseSchema.parse(data).user;
}

export async function registerAccount(username: string, password: string): Promise<AccountUser> {
  const body = AuthCredentialsSchema.parse({ username, password });
  const { data } = await client.post<unknown>('/auth/register', body);
  return AuthResponseSchema.parse(data).user;
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
