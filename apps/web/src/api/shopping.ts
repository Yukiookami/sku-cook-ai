import {
  CookShoppingBatchInputSchema,
  ShoppingBatchResponseSchema,
  ShoppingBatchesResponseSchema,
  ShoppingPreviewSchema,
  type CookShoppingBatchInput,
  type ShoppingPreviewInput,
} from '@sku-cook/shared';
import { client } from './client';

export async function previewShopping(input: ShoppingPreviewInput) {
  return ShoppingPreviewSchema.parse((await client.post<unknown>('/shopping/preview', input)).data);
}
export async function listShoppingBatches() {
  return ShoppingBatchesResponseSchema.parse((await client.get<unknown>('/shopping/batches')).data)
    .batches;
}
export async function saveShoppingBatch(input: CookShoppingBatchInput) {
  const body = CookShoppingBatchInputSchema.parse(input);
  return ShoppingBatchResponseSchema.parse(
    (await client.put<unknown>(`/shopping/batches/${body.batchId}`, body)).data,
  ).batch;
}
export async function sendShoppingBatch(id: string) {
  return ShoppingBatchResponseSchema.parse(
    (await client.post<unknown>(`/shopping/batches/${id}/send`, {})).data,
  ).batch;
}
