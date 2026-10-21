import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, ShoppingBatch as StoredBatch } from '@prisma/client';
import {
  CookShoppingBatchInputSchema,
  ShoppingBatchSchema,
  ShoppingReceiptSchema,
  type CookShoppingBatchInput,
} from '@sku-cook/shared';
import { z } from 'zod';
import { ApiError } from '../common/errors.js';
import { lockUser } from '../common/transaction.js';

export type ShoppingIntegration = { origin: string; token: string; userId: string };
export function requireShoppingUser(config: ShoppingIntegration | undefined, userId: number) {
  if (!config)
    throw new ApiError(
      503,
      'SHOPPING_NOT_CONFIGURED',
      '采购集成尚未启用，请配置服务端专用凭据和绑定账号。',
    );
  if (config.userId !== String(userId))
    throw new ApiError(403, 'SHOPPING_FORBIDDEN', '当前账号未绑定采购发送权限。');
  return config;
}

export function shoppingBatchDto(batch: StoredBatch) {
  return ShoppingBatchSchema.parse({
    payload: batch.payload,
    status: batch.status,
    errorCode: batch.errorCode,
    message: batch.message,
    receipt: batch.receipt,
    createdAt: batch.createdAt.toISOString(),
  });
}

export async function readShoppingBatch(prisma: PrismaClient, userId: number, id: string) {
  const record = await prisma.shoppingBatch.findFirst({ where: { id, userId } });
  if (!record) throw new ApiError(404, 'SHOPPING_BATCH_NOT_FOUND', '采购批次不存在。');
  return record;
}

export async function saveShoppingBatch(
  prisma: PrismaClient,
  userId: number,
  input: CookShoppingBatchInput,
) {
  const payload = CookShoppingBatchInputSchema.parse(input);
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const existing = await tx.shoppingBatch.findUnique({ where: { id: payload.batchId } });
    if (existing) {
      if (existing.userId !== userId)
        throw new ApiError(404, 'SHOPPING_BATCH_NOT_FOUND', '采购批次不存在。');
      if (existing.payloadHash !== payloadHash)
        throw new ApiError(
          409,
          'IDEMPOTENCY_CONFLICT',
          '同一采购批次不能更改内容，请保留原批次核对；新采购须明确重新创建。',
        );
      return existing;
    }
    const ids = payload.recipes.map((recipe) => Number(recipe.recipeId));
    if (
      payload.recipes.some((recipe, index) => {
        const id = ids[index];
        return (
          id === undefined ||
          id < 1 ||
          id > 2147483647 ||
          String(id) !== recipe.recipeId ||
          !Number.isSafeInteger(id)
        );
      })
    ) {
      throw new ApiError(400, 'INVALID_INPUT', '采购菜谱编号无效。');
    }
    const count = await tx.recipe.count({ where: { id: { in: ids }, userId } });
    if (count !== ids.length)
      throw new ApiError(404, 'RECIPE_NOT_FOUND', '采购菜谱不存在或不属于当前账号。');
    return tx.shoppingBatch.create({ data: { id: payload.batchId, userId, payload, payloadHash } });
  });
}

const TodoImportResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    batchId: z.uuid(),
    task: z.object({ id: z.uuid() }),
  }),
  meta: ShoppingReceiptSchema,
});
const TodoErrorSchema = z.object({ error: z.object({ code: z.string() }) });

export async function sendShoppingBatch(
  prisma: PrismaClient,
  userId: number,
  id: string,
  config: ShoppingIntegration,
) {
  const current = await readShoppingBatch(prisma, userId, id);
  if (current.status === 'succeeded' || current.status === 'conflict') return current;
  const attemptId = randomUUID();
  const now = new Date();
  const claim = await prisma.shoppingBatch.updateMany({
    where: {
      id,
      userId,
      status: { in: ['pending', 'failed', 'sending'] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: {
      status: 'sending',
      leaseUntil: new Date(now.getTime() + 30000),
      attemptId,
      errorCode: null,
      message: null,
    },
  });
  if (!claim.count)
    throw new ApiError(
      409,
      'SHOPPING_SEND_IN_PROGRESS',
      '该采购批次正在发送，请稍后读取原批次，不要新建采购。',
    );
  const payload = CookShoppingBatchInputSchema.parse(current.payload);
  let result: {
    status: string;
    errorCode: string | null;
    message: string | null;
    receipt?: z.infer<typeof ShoppingReceiptSchema>;
  } = {
    status: 'failed',
    errorCode: 'TODO_NETWORK_UNCERTAIN',
    message: '发送结果暂未确认，可能已送达；请重试原批次，不要另建采购。',
  };
  try {
    const response = await fetch(`${config.origin}/api/v1/integrations/cook/batches`, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (response.status === 200 || response.status === 201) {
      const parsed = TodoImportResponseSchema.safeParse(raw);
      if (parsed.success) {
        const { data, meta } = parsed.data;
        const url = new URL(meta.url);
        if (
          meta.shoppingId === id &&
          data.id === id &&
          data.batchId === id &&
          meta.taskId === data.task.id &&
          url.origin === config.origin &&
          url.pathname === `/shopping/${id}` &&
          !url.search &&
          !url.hash &&
          !url.username &&
          !url.password
        ) {
          result = { status: 'succeeded', receipt: meta, errorCode: null, message: null };
        } else {
          result = {
            status: 'failed',
            errorCode: 'TODO_INVALID_RECEIPT',
            message: '采购回执编号或链接不可信，请核对服务端配置并重试原批次。',
          };
        }
      } else {
        result = {
          status: 'failed',
          errorCode: 'TODO_INVALID_RECEIPT',
          message: '采购回执格式不正确，请重试原批次核对结果。',
        };
      }
    } else {
      const parsed = TodoErrorSchema.safeParse(raw);
      const conflict =
        response.status === 409 &&
        parsed.success &&
        parsed.data.error.code === 'IDEMPOTENCY_CONFLICT';
      const message = conflict
        ? 'Todo 拒绝：同一批次 ID 已用于不同内容，不能自动换 ID 重发。'
        : response.status === 401
          ? 'Todo 专用凭据无效，请检查两端服务端集成配置。'
          : response.status === 404 &&
              parsed.success &&
              parsed.data.error.code === 'INTEGRATION_NOT_CONFIGURED'
            ? 'Todo 采购集成尚未启用，请检查服务端配置。'
            : response.status === 429
              ? 'Todo 请求过于频繁，请稍后重试原批次。'
              : 'Todo 未确认接收，请保留并重试原批次；不会自动新建采购。';
      result = {
        status: conflict ? 'conflict' : 'failed',
        errorCode: conflict ? 'IDEMPOTENCY_CONFLICT' : `TODO_HTTP_${response.status}`,
        message,
      };
    }
  } catch (error) {
    // 不记录 fetch 错误对象：其中可能包含带凭据的请求信息。
    if (
      !(error instanceof TypeError) &&
      !(error instanceof SyntaxError) &&
      !(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
    )
      throw error;
  }
  await prisma.shoppingBatch.updateMany({
    where: { id, userId, attemptId },
    data: { ...result, leaseUntil: null, attemptId: null },
  });
  return readShoppingBatch(prisma, userId, id);
}
