import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@sku-cook/shared';
import { buildApp } from '../../app.js';

describe('API foundation', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp('postgresql://test:test@127.0.0.1:5432/test');
    app.get('/api/test-error', () => {
      throw new Error('private database details');
    });
    await app.ready();
  });
  afterEach(async () => app.close());

  it('returns the shared health contract without accessing the database', async () => {
    const response = await request(app.server).get('/api/health').expect(200);
    expect(HealthResponseSchema.parse(response.body).status).toBe('ok');
  });

  it('returns a readable 404', async () => {
    const response = await request(app.server).get('/api/missing').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose internal errors', async () => {
    const response = await request(app.server).get('/api/test-error').expect(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private database details');
  });
});
