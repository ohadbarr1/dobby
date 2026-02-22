import cron from 'node-cron';
import { sendDailyBriefing } from './handlers/briefingHandler';
import * as reminderRepo from './db/repositories/reminderRepo';
import { sendToGroup } from './bot/whatsappClient';
import logger from './utils/logger';

const scheduledTasks: { stop: () => void }[] = [];

async function checkReminders(): Promise<void> {
  try {
    const pending = await reminderRepo.getPendingReminders();
    if (!pending.length) return;

    for (const reminder of pending) {
      try {
        await sendToGroup(
          reminder.whatsappGroupId,
          `\u{23F0} Reminder for *${reminder.forWhom}*: ${reminder.message}`
        );
        await reminderRepo.markReminderSent(reminder.id);
        logger.info(`Sent reminder #${reminder.id}`);
      } catch (err) {
        logger.error(`Failed to send reminder #${reminder.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    logger.error(`Reminder check failed: ${(err as Error).message}`);
  }
}

export function startCronJobs(): void {
  // Check briefings every minute (each family has its own schedule)
  const briefingTask = cron.schedule('* * * * *', sendDailyBriefing);
  scheduledTasks.push(briefingTask);
  logger.info('Daily briefing checker running every minute');

  // Reminder checker every minute
  const reminderTask = cron.schedule('* * * * *', checkReminders);
  scheduledTasks.push(reminderTask);
  logger.info('Reminder checker running every minute');
}

export function stopCronJobs(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  logger.info('Cron jobs stopped');
}
