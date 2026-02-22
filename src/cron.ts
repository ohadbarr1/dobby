import cron from 'node-cron';
import { sendDailyBriefing } from './handlers/briefingHandler';
import { getPendingReminders, markReminderSent } from './db/database';
import { sendToGroup } from './bot/whatsappClient';
import config from './utils/config';
import logger from './utils/logger';

async function checkReminders(): Promise<void> {
  const pending = getPendingReminders();
  if (!pending.length) return;

  for (const reminder of pending) {
    try {
      await sendToGroup(`\u{23F0} Reminder for *${reminder.for_whom}*: ${reminder.message}`);
      markReminderSent(reminder.id);
      logger.info(`Sent reminder #${reminder.id}`);
    } catch (err) {
      logger.error(`Failed to send reminder #${reminder.id}: ${(err as Error).message}`);
    }
  }
}

export function startCronJobs(): void {
  const tz = config.TIMEZONE;

  // Daily briefing
  cron.schedule(
    `${config.BRIEFING_MINUTE} ${config.BRIEFING_HOUR} * * *`,
    sendDailyBriefing,
    { timezone: tz }
  );
  logger.info(
    `Daily briefing scheduled for ${config.BRIEFING_HOUR}:${config.BRIEFING_MINUTE} (${tz})`
  );

  // Reminder checker every minute
  cron.schedule('* * * * *', checkReminders, { timezone: tz });
  logger.info('Reminder checker running every minute');
}
