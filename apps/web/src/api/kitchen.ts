import {
  KitchenActiveInputSchema,
  KitchenReplaceInputSchema,
  KitchenRevisionInputSchema,
  KitchenStateResponseSchema,
  KitchenEventSchema,
  type KitchenActiveInput,
  type KitchenReplaceInput,
  type KitchenRevisionInput,
  type KitchenStateResponse,
} from '@sku-cook/shared';
import { client } from './client';

export function watchKitchenChanges(
  onChange: () => void,
  onConnection: (connected: boolean) => void,
): () => void {
  let stopped = false;
  let source: EventSource | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const disconnect = () => {
    clearTimeout(watchdog);
    source?.close();
    source = undefined;
  };
  const fail = () => {
    if (stopped) return;
    disconnect();
    onConnection(false);
    clearTimeout(retry);
    retry = setTimeout(connect, 10_000);
  };
  function connect() {
    if (stopped) return;
    const current = new EventSource(client.getUri({ url: '/kitchen/events' }), {
      withCredentials: true,
    });
    source = current;
    watchdog = setTimeout(fail, 75_000);
    current.onerror = () => {
      if (source === current) fail();
    };
    current.onmessage = (event) => {
      if (stopped || source !== current) return;
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        console.warn('厨房实时消息格式无效，已切换为定时检查。');
        fail();
        return;
      }
      const parsed = KitchenEventSchema.safeParse(value);
      if (!parsed.success) {
        console.warn('厨房实时消息不符合协议，已切换为定时检查。');
        fail();
        return;
      }
      if (parsed.data.type === 'reconnect') {
        disconnect();
        connect();
        return;
      }
      clearTimeout(watchdog);
      watchdog = setTimeout(fail, 75_000);
      if (parsed.data.type === 'ready') onConnection(true);
      if (parsed.data.type !== 'heartbeat') onChange();
    };
  }
  if (typeof EventSource === 'undefined') onConnection(false);
  else connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    disconnect();
  };
}

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
