import fs from 'fs';
import logger from './utils/logger';
import './utils/config';
import { initDb, closeDb } from './db/database';
import { startBot, destroyClient } from './bot/whatsappClient';
import { startCronJobs, stopCronJobs } from './cron';

async function main(): Promise<void> {
  logger.info('\u{1F916} Dobby is starting up...');

  // Ensure logs directory exists
  fs.mkdirSync('logs', { recursive: true });

  await initDb();
  await startBot();
  startCronJobs();

  logger.info('\u{2705} Dobby is ready');
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  const timeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);

  try {
    stopCronJobs();
    await destroyClient();
    await closeDb();
    clearTimeout(timeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error(`Shutdown error: ${(err as Error).message}`);
    clearTimeout(timeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

main().catch((err: Error) => {
  logger.error(err.message);
  process.exit(1);
});
