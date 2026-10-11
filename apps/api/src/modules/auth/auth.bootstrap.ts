import { PasswordSchema } from '@sku-cook/shared';
import type { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth.crypto.js';

export async function bootstrapUser(prisma: PrismaClient, password: string | undefined) {
  const input = PasswordSchema.safeParse(password);
  if (!input.success) {
    // 不输出 Zod 输入或环境值。
    throw new Error('BOOTSTRAP_USER_PASSWORD 必须是 8–128 字符且不全为空白');
  }
  const passwordHash = await hashPassword(input.data);
  return prisma.$transaction(async (tx) => {
    // 与注册的 users 写入互斥，序列前进与显式 id=1 初始化一起完成。
    await tx.$executeRaw`LOCK TABLE users IN EXCLUSIVE MODE`;
    const user = await tx.user.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: 'default-user',
        username: 'Sku001',
        usernameKey: 'sku001',
        isSuperAdmin: true,
        passwordHash,
      },
    });
    // 仅初始化无密码旧用户；重复 Seed 不更改已设密码、资料或业务数据。
    await tx.user.updateMany({
      where: { id: 1, passwordHash: null },
      data: { passwordHash },
    });
    await tx.$queryRaw`
      SELECT setval(pg_get_serial_sequence('users', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM users), 1),
                 (SELECT last_value FROM users_id_seq)), true)
    `;
    return user.id;
  });
}
