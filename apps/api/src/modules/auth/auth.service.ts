import type {
  LoginRequest,
  RegisterRequest,
  UpdatePasswordRequest,
  UpdateUsernameRequest,
} from '@sku-cook/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { ApiError, isPrismaCode } from '../common/errors.js';
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from './auth.crypto.js';

const publicUserSelect = { id: true, username: true, email: true, isSuperAdmin: true } as const;
function publicUser(user: {
  id: number;
  username: string;
  email: string | null;
  isSuperAdmin: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  };
}

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

function isEmailConflict(error: unknown): boolean {
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
    (Array.isArray(meta.target) && meta.target.includes('email')) ||
    meta.target === 'users_email_lower_key' ||
    meta.target === 'users_email_key'
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
      select: publicUserSelect,
    });
    return publicUser(user);
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
      select: publicUserSelect,
    });
    return publicUser(user);
  });
}

export async function register(
  prisma: PrismaClient,
  input: RegisterRequest,
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
          email: input.email,
          passwordHash,
        },
        select: publicUserSelect,
      });
      const token = await createSession(tx, user.id, previousToken);
      return { user: publicUser(user), token };
    });
  } catch (error) {
    // 仅映射用户唯一键；token 碰撞不伪装为账号冲突。
    if (isUsernameConflict(error)) throw new ApiError(409, 'USERNAME_TAKEN', '账号名已被使用');
    if (isEmailConflict(error)) throw new ApiError(409, 'EMAIL_TAKEN', '邮箱已被使用');
    throw error;
  }
}

export async function login(prisma: PrismaClient, input: LoginRequest, previousToken?: string) {
  const record = await prisma.user.findUnique({
    where: input.username.includes('@')
      ? { email: input.username.toLowerCase() }
      : { usernameKey: input.username.toLowerCase() },
  });
  const matches = await verifyPassword(input.password, record?.passwordHash ?? null);
  if (!record || !matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '账号或密码不正确');
  }
  const token = await prisma.$transaction((tx) => createSession(tx, record.id, previousToken));
  return {
    user: {
      id: record.id,
      username: record.username,
      email: record.email,
      isSuperAdmin: record.isSuperAdmin,
    },
    token,
  };
}
