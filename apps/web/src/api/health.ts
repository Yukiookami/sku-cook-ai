import { HealthResponseSchema, type HealthResponse } from '@sku-cook/shared';
import { client } from './client';

export async function getHealth(): Promise<HealthResponse> {
  const response = await client.get<unknown>('/health');
  return HealthResponseSchema.parse(response.data);
}
