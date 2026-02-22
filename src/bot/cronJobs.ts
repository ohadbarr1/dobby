import cron from 'node-cron';
import { getClient } from './whatsappClient';
import { getEvents } from '../integrations/googleCalendar';
import { getTasks } from '../integrations/todoist';
import { getPendingReminders, markReminderSent } from '../db/database';
import config from '../utils/config';
import logger from '../utils/logger';

function todayRange(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function sendMorningBriefing(): Promise<void> {
  logger.info('Sending morning briefing...');
  const { start, end } = todayRange();
  const lines: string[] = ['🌅 *Good morning! Here\'s your daily briefing:*\n'];

  for (const [name, refreshToken, calendarId] of [
    [config.USER1_NAME, config.GOOGLE_REFRESH_TOKEN_USER1, config.GOOGLE_CALENDAR_ID_USER1],
    [config.USER2_NAME, config.GOOGLE_REFRESH_TOKEN_USER2, config.GOOGLE_CALENDAR_ID_USER2],
  ]) {
    try {
      const events = await getEvents(calendarId, refreshToken, start, end);
      if (events.length) {
        lines.push(`📅 *${name}'s events today:*`);
        events.forEach((e) => lines.push(`  • ${e.title}`));
        lines.push('');
      }
    } catch (err) {
      logger.error(`Briefing: calendar fetch failed for ${name}: ${(err as Error).message}`);
    }
  }

  try {
    const tasks = await getTasks('all');
    if (tasks.length) {
      lines.push('✅ *Open tasks:*');
      tasks.forEach((t) => lines.push(`  • ${t}`));
    }
  } catch (err) {
    logger.error(`Briefing: tasks fetch failed: ${(err as Error).message}`);
  }

  try {
    await getClient().sendMessage(config.WHATSAPP_GROUP_ID, lines.join('\n'));
  } catch (err) {
    logger.error(`Briefing: send failed: ${(err as Error).message}`);
  }
}

async function checkReminders(): Promise<void> {
  const pending = getPendingReminders();
  if (!pending.length) return;

  const client = getClient();
  for (const reminder of pending) {
    try {
      await client.sendMessage(
        config.WHATSAPP_GROUP_ID,
        `⏰ Reminder for *${reminder.for_whom}*: ${reminder.message}`
      );
      markReminderSent(reminder.id);
      logger.info(`Sent reminder #${reminder.id}`);
    } catch (err) {
      logger.error(`Failed to send reminder #${reminder.id}: ${(err as Error).message}`);
    }
  }
}

export function startCronJobs(): void {
  const tz = config.TIMEZONE;

  cron.schedule(
    `${config.BRIEFING_MINUTE} ${config.BRIEFING_HOUR} * * *`,
    sendMorningBriefing,
    { timezone: tz }
  );
  logger.info(
    `Morning briefing scheduled for ${config.BRIEFING_HOUR}:${config.BRIEFING_MINUTE} (${tz})`
  );

  cron.schedule('* * * * *', checkReminders, { timezone: tz });
  logger.info('Reminder checker running every minute');
}
