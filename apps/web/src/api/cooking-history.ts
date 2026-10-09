import {
  CookingHistoryInputSchema,
  CookingHistoryListQuerySchema,
  CookingHistoryListResponseSchema,
  CookingHistoryResponseSchema,
  CookingHistoryIdParamsSchema,
  type CookingHistory,
  type CookingHistoryInput,
  type CookingHistoryListResponse,
} from '@sku-cook/shared';
import { client } from './client';

export async function getCookingHistory(page: number): Promise<CookingHistoryListResponse> {
  const params = CookingHistoryListQuerySchema.parse({ page, pageSize: 20 });
  const { data } = await client.get<unknown>('/cooking-history', { params });
  return CookingHistoryListResponseSchema.parse(data);
}

export async function recordCookingHistory(input: CookingHistoryInput): Promise<CookingHistory> {
  const body = CookingHistoryInputSchema.parse(input);
  const { data } = await client.post<unknown>('/cooking-history', body);
  return CookingHistoryResponseSchema.parse(data).history;
}

export async function deleteCookingHistory(id: number): Promise<void> {
  const params = CookingHistoryIdParamsSchema.parse({ id });
  await client.delete(`/cooking-history/${params.id}`);
}
