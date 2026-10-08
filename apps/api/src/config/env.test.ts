import { describe, expect, it } from 'vitest';
import { readConfig } from './env.js';

describe('server configuration', () => {
  it('requires a database URL', () => {
    expect(() => readConfig({})).toThrow();
  });

  it('rejects invalid ports and database protocols', () => {
    expect(() => readConfig({ DATABASE_URL: 'not-a-url' })).toThrow();
    expect(() => readConfig({ DATABASE_URL: 'https://example.com', PORT: '3000' })).toThrow();
    expect(() =>
      readConfig({ DATABASE_URL: 'postgresql://localhost/test', PORT: '70000' }),
    ).toThrow();
  });

  it('applies the default user and listen address', () => {
    const config = readConfig({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(config.DEFAULT_USER_ID).toBe(1);
    expect(config.HOST).toBe('127.0.0.1');
  });
});
