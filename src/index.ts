import logger from './utils/logger';
import './utils/config'; // validates all env vars on import
import { initDb } from './db/database';
import { startCronJobs } from './bot/cronJobs';
import { startBot } from './bot/whatsappClient';

async function main(): Promise<void> {
  logger.info('🤖 Dobby is starting up...');
  initDb();
  startCronJobs();
  await startBot(); // blocks until WhatsApp disconnects
}

main().catch((err: Error) => {
  logger.error(err.message);
  process.exit(1);
});
