import logger from './utils/logger';

try {
  // Validate all required environment variables on startup
  import('./utils/config').then(() => {
    logger.info('🤖 Dobby is starting up...');

    // TODO: initDb()
    // TODO: startBot()
    // TODO: startCronJobs()
  }).catch((err: Error) => {
    logger.error(err.message);
    process.exit(1);
  });
} catch (err) {
  logger.error((err as Error).message);
  process.exit(1);
}
