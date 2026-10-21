import { describe, expect, it } from 'vitest';
import { KitchenEventSchema } from './kitchen.js';

describe('厨房实时事件Contract', () => {
  it('仅接受无业务内容的就绪、变更和心跳事件', () => {
    for (const type of ['ready', 'changed', 'heartbeat', 'reconnect']) {
      expect(KitchenEventSchema.parse({ type })).toEqual({ type });
    }
    for (const value of [
      {},
      { type: 'unknown' },
      { type: 'changed', userId: 1 },
      { type: 'changed', recipes: [] },
    ]) {
      expect(KitchenEventSchema.safeParse(value).success).toBe(false);
    }
  });
});
