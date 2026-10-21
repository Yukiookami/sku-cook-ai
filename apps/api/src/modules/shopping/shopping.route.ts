import type { FastifyInstance } from 'fastify';
import {
  CookShoppingBatchInputSchema,
  ShoppingBatchParamsSchema,
  ShoppingBatchResponseSchema,
  ShoppingBatchesResponseSchema,
  ShoppingEmptySchema,
  ShoppingPreviewInputSchema,
  SHOPPING_MAX_BYTES,
} from '@sku-cook/shared';
import { authenticatedUser } from '../auth/auth.session.js';
import { ApiError } from '../common/errors.js';
import { shoppingPreview } from './shopping.preview.js';
import {
  readShoppingBatch,
  requireShoppingUser,
  saveShoppingBatch,
  sendShoppingBatch,
  shoppingBatchDto,
  type ShoppingIntegration,
} from './shopping.service.js';

export async function shoppingRoutes(
  app: FastifyInstance,
  options: { integration?: ShoppingIntegration },
) {
  function authorize(request: Parameters<typeof authenticatedUser>[0]) {
    const { id } = authenticatedUser(request);
    const config = requireShoppingUser(options.integration, id);
    ShoppingEmptySchema.parse(request.query);
    return { userId: id, config };
  }
  app.post('/shopping/preview', async (request) => {
    const { userId } = authorize(request);
    const input = ShoppingPreviewInputSchema.parse(request.body);
    if (input.items.some((item) => item.recipeId > 2147483647)) {
      throw new ApiError(400, 'INVALID_INPUT', '采购菜谱编号无效。');
    }
    const records = await app.prisma.recipe.findMany({
      where: { userId, id: { in: input.items.map((item) => item.recipeId) } },
      include: { ingredients: { orderBy: { position: 'asc' } } },
    });
    if (records.length !== input.items.length)
      throw new ApiError(404, 'RECIPE_NOT_FOUND', '菜谱不存在或不属于当前账号。');
    return shoppingPreview(records, input);
  });
  app.get('/shopping/batches', async (request) => {
    const { userId } = authorize(request);
    const records = await app.prisma.shoppingBatch.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return ShoppingBatchesResponseSchema.parse({ batches: records.map(shoppingBatchDto) });
  });
  app.get('/shopping/batches/:id', async (request) => {
    const { userId } = authorize(request);
    const { id } = ShoppingBatchParamsSchema.parse(request.params);
    return ShoppingBatchResponseSchema.parse({
      batch: shoppingBatchDto(await readShoppingBatch(app.prisma, userId, id)),
    });
  });
  app.put('/shopping/batches/:id', { bodyLimit: SHOPPING_MAX_BYTES }, async (request) => {
    const { userId } = authorize(request);
    const { id } = ShoppingBatchParamsSchema.parse(request.params);
    const input = CookShoppingBatchInputSchema.parse(request.body);
    if (id !== input.batchId)
      throw new ApiError(400, 'INVALID_INPUT', '路径与采购批次编号不一致。');
    return ShoppingBatchResponseSchema.parse({
      batch: shoppingBatchDto(await saveShoppingBatch(app.prisma, userId, input)),
    });
  });
  app.post('/shopping/batches/:id/send', async (request) => {
    const { userId, config } = authorize(request);
    ShoppingEmptySchema.parse(request.body ?? {});
    const { id } = ShoppingBatchParamsSchema.parse(request.params);
    const record = await sendShoppingBatch(app.prisma, userId, id, config);
    if (record.status !== 'succeeded')
      request.log.warn({ batchId: id, code: record.errorCode }, '采购批次未获成功回执');
    return ShoppingBatchResponseSchema.parse({ batch: shoppingBatchDto(record) });
  });
}
