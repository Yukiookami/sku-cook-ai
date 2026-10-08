import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts the API contract', () => {
    expect(HealthResponseSchema.parse({ status: 'ok', service: 'sku-cook-ai-api' })).toEqual({
      status: 'ok',
      service: 'sku-cook-ai-api',
    });
  });

  it('rejects an invalid service status', () => {
    expect(
      HealthResponseSchema.safeParse({ status: 'failed', service: 'sku-cook-ai-api' }).success,
    ).toBe(false);
  });
});
