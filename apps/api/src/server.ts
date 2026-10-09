import 'dotenv/config';
import { buildApp } from './app.js';
import { readConfig } from './config/env.js';

const config = readConfig(process.env);
const app = buildApp(
  config.DATABASE_URL,
  { logger: { level: config.LOG_LEVEL } },
  {
    defaultUserId: config.DEFAULT_USER_ID,
    kitchenPollIntervalSeconds: config.KITCHEN_POLL_INTERVAL_SECONDS,
  },
);

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Failed to shut down cleanly');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error, 'Failed to start API');
  await app.close();
  process.exitCode = 1;
}
