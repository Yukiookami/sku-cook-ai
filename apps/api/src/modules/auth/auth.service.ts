import type { AuthCredentials } from '@sku-cook/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ApiError, isPrismaCode } from '../common/errors.js';
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from './auth.crypto.js';

async function createSession(tx: Prisma.TransactionClient, userId: number, previousToken?: string) {
  const token = newSessionToken();
  await tx.authSession.create({ data: { userId, tokenHash: hashSessionToken(token) } });
  if (previousToken) {
    await tx.authSession.deleteMany({ where: { tokenHash: hashSessionToken(previousToken) } });
  }
  return token;
}

export async function register(
  prisma: PrismaClient,
  input: AuthCredentials,
  previousToken?: string,
) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.username,
          username: input.username,
          usernameKey: input.username.toLowerCase(),
          passwordHash,
        },
        select: { id: true, username: true },
      });
      const token = await createSession(tx, user.id, previousToken);
      return { user: { id: user.id, username: user.username }, token };
    });
  } catch (error) {
    // 本事务唯一用户写入为 usernameKey；token 碰撞不伪装为账号冲突。
    if (
      isPrismaCode(error, 'P2002') &&
      typeof error === 'object' &&
      error !== null &&
      'meta' in error
    ) {
      const meta = error.meta;
      if (typeof meta === 'object' && meta !== null && 'target' in meta) {
        const target = meta.target;
        if (
          (Array.isArray(target) && target.includes('username_key')) ||
          target === 'users_username_key_key'
        ) {
          throw new ApiError(409, 'USERNAME_TAKEN', '账号名已被使用');
        }
      }
    }
    throw error;
  }
}

export async function login(prisma: PrismaClient, input: AuthCredentials, previousToken?: string) {
  const record = await prisma.user.findUnique({
    where: { usernameKey: input.username.toLowerCase() },
  });
  const matches = await verifyPassword(input.password, record?.passwordHash ?? null);
  if (!record || !matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '账号或密码不正确');
  }
  const token = await prisma.$transaction((tx) => createSession(tx, record.id, previousToken));
  return { user: { id: record.id, username: record.username }, token };
}
