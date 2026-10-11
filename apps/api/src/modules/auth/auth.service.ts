import type {
  AuthCredentials,
  UpdatePasswordRequest,
  UpdateUsernameRequest,
} from '@sku-cook/shared';
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

function isUsernameConflict(error: unknown): boolean {
  if (
    !isPrismaCode(error, 'P2002') ||
    typeof error !== 'object' ||
    error === null ||
    !('meta' in error)
  )
    return false;
  const meta = error.meta;
  if (typeof meta !== 'object' || meta === null || !('target' in meta)) return false;
  return (
    (Array.isArray(meta.target) && meta.target.includes('username_key')) ||
    meta.target === 'users_username_key_key'
  );
}

export async function updateUsername(
  prisma: PrismaClient,
  userId: number,
  input: UpdateUsernameRequest,
) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.username,
        username: input.username,
        usernameKey: input.username.toLowerCase(),
      },
      select: { id: true, username: true },
    });
    return { id: user.id, username: user.username };
  } catch (error) {
    if (isUsernameConflict(error)) throw new ApiError(409, 'USERNAME_TAKEN', '账号名已被使用');
    throw error;
  }
}

export async function updatePassword(
  prisma: PrismaClient,
  userId: number,
  input: UpdatePasswordRequest,
) {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!record || !(await verifyPassword(input.currentPassword, record.passwordHash))) {
    throw new ApiError(400, 'CURRENT_PASSWORD_INCORRECT', '当前密码不正确');
  }
  const passwordHash = await hashPassword(input.newPassword);
  return prisma.$transaction(async (tx) => {
    // 校验后可能有另一次改密完成：按原散列比较更新，不允许旧密码覆盖新密码。
    const result = await tx.user.updateMany({
      where: { id: userId, passwordHash: record.passwordHash },
      data: { passwordHash },
    });
    if (result.count !== 1)
      throw new ApiError(409, 'PASSWORD_CHANGED', '密码已被修改，请重新输入当前密码');
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true },
    });
    return { id: user.id, username: user.username };
  });
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
    if (isUsernameConflict(error)) throw new ApiError(409, 'USERNAME_TAKEN', '账号名已被使用');
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
