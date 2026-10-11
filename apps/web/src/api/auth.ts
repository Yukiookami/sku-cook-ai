import { AuthCredentialsSchema, AuthResponseSchema, type AuthUser } from '@sku-cook/shared';
import { client } from './client';

export type AccountUser = AuthUser;

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
