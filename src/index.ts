import logger from './utils/logger';
import './utils/config'; // validates all env vars on import
import { initDb } from './db/database';
import { startBot } from './bot/whatsappClient';
import { startCronJobs } from './cron';

async function main(): Promise<void> {
  logger.info('\u{1F916} Dobby is starting up...');
  initDb();
  await startBot(); // blocks until WhatsApp is ready
  startCronJobs();  // schedule cron after bot is connected
}

main().catch((err: Error) => {
  logger.error(err.message);
  process.exit(1);
});
