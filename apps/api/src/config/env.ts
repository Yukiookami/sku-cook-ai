import { z } from 'zod';

const ConfigSchema = z
  .object({
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .url()
      .refine(
        (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
        'DATABASE_URL must use PostgreSQL',
      ),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ORIGIN: z
      .url()
      .refine((value) => {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
      }, 'APP_ORIGIN must be an exact HTTP(S) origin')
      .optional(),
    KITCHEN_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(300).default(10),
    TODO_ORIGIN: z
      .url()
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
      }, 'TODO_ORIGIN must be an exact HTTPS origin')
      .default('https://todo.taila48442.ts.net'),
    TODO_COOK_INTEGRATION_TOKEN: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{32,256}$/, '采购集成 token 格式无效')
      .optional(),
    TODO_COOK_USER_ID: z
      .string()
      .regex(/^[1-9]\d*$/, '采购绑定必须是做菜账号稳定数字 ID')
      .max(200)
      .optional(),
  })
  .superRefine((config, context) => {
    if (Boolean(config.TODO_COOK_INTEGRATION_TOKEN) !== Boolean(config.TODO_COOK_USER_ID)) {
      context.addIssue({ code: 'custom', message: '采购 token 与绑定用户 ID 必须同时配置' });
    }
  });

export function readConfig(environment: NodeJS.ProcessEnv) {
  return ConfigSchema.parse(environment);
}
