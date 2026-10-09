import { z } from 'zod';

const ConfigSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .url()
    .refine(
      (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
      'DATABASE_URL must use PostgreSQL',
    ),
  DEFAULT_USER_ID: z.coerce.number().int().positive().default(1),
  KITCHEN_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(300).default(10),
});

export function readConfig(environment: NodeJS.ProcessEnv) {
  return ConfigSchema.parse(environment);
}
