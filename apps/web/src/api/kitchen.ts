import {
  KitchenActiveInputSchema,
  KitchenReplaceInputSchema,
  KitchenRevisionInputSchema,
  KitchenStateResponseSchema,
  type KitchenActiveInput,
  type KitchenReplaceInput,
  type KitchenRevisionInput,
  type KitchenStateResponse,
} from '@sku-cook/shared';
import { client } from './client';

export async function getKitchenState(): Promise<KitchenStateResponse> {
  const { data } = await client.get<unknown>('/kitchen/session');
  return KitchenStateResponseSchema.parse(data);
}

export async function replaceKitchenMenu(
  input: KitchenReplaceInput,
): Promise<KitchenStateResponse> {
  const body = KitchenReplaceInputSchema.parse(input);
  const { data } = await client.put<unknown>('/kitchen/session', body);
  return KitchenStateResponseSchema.parse(data);
}

export async function setKitchenActiveRecipe(
  input: KitchenActiveInput,
): Promise<KitchenStateResponse> {
  const body = KitchenActiveInputSchema.parse(input);
  const { data } = await client.patch<unknown>('/kitchen/session/active', body);
  return KitchenStateResponseSchema.parse(data);
}

export async function clearKitchenMenu(input: KitchenRevisionInput): Promise<KitchenStateResponse> {
  const body = KitchenRevisionInputSchema.parse(input);
  const { data } = await client.delete<unknown>('/kitchen/session', { data: body });
  return KitchenStateResponseSchema.parse(data);
}

export async function completeKitchenMenu(
  input: KitchenRevisionInput,
): Promise<KitchenStateResponse> {
  const body = KitchenRevisionInputSchema.parse(input);
  const { data } = await client.post<unknown>('/kitchen/session/complete', body);
  return KitchenStateResponseSchema.parse(data);
}
