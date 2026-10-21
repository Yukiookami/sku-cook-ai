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

  it('applies development defaults and listen address without a default business user', () => {
    const config = readConfig({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(config.NODE_ENV).toBe('development');
    expect(config.HOST).toBe('127.0.0.1');
  });

  it('accepts only an exact HTTP(S) browser origin', () => {
    const base = { DATABASE_URL: 'postgresql://localhost/test' };
    expect(readConfig({ ...base, APP_ORIGIN: 'http://localhost:5173' }).APP_ORIGIN).toBe(
      'http://localhost:5173',
    );
    for (const APP_ORIGIN of [
      'http://localhost:5173/',
      'https://example.com/path',
      'ftp://example.com',
    ]) {
      expect(() => readConfig({ ...base, APP_ORIGIN })).toThrow();
    }
  });
  it('requires paired server-only shopping credentials and an exact HTTPS Todo origin', () => {
    const base = { DATABASE_URL: 'postgresql://localhost/test' };
    const credentials = { TODO_COOK_USER_ID: '1', TODO_COOK_INTEGRATION_TOKEN: 'a'.repeat(64) };
    expect(readConfig({ ...base, ...credentials }).TODO_ORIGIN).toBe(
      'https://todo.taila48442.ts.net',
    );
    for (const input of [
      { TODO_COOK_USER_ID: '1' },
      { TODO_COOK_INTEGRATION_TOKEN: 'a'.repeat(64) },
      { ...credentials, TODO_COOK_USER_ID: ' 1' },
      { ...credentials, TODO_COOK_USER_ID: 'a@example.test' },
      { ...credentials, TODO_COOK_INTEGRATION_TOKEN: 'short' },
      { ...credentials, TODO_ORIGIN: 'http://todo.example.test' },
      { ...credentials, TODO_ORIGIN: 'https://todo.example.test/path' },
    ])
      expect(() => readConfig({ ...base, ...input })).toThrow();
  });
});
