import cron from 'node-cron';
import { getClient } from './whatsappClient';
import { getUpcomingEvents, CalendarEvent } from '../integrations/googleCalendar';
import { getTasks } from '../integrations/todoist';
import { getPendingReminders, markReminderSent } from '../db/database';
import config from '../utils/config';
import logger from '../utils/logger';

function formatBriefingEvents(events: CalendarEvent[]): string[] {
  return events.map((e) => {
    const time = e.isAllDay
      ? 'All day'
      : e.start.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `  \u{2022} ${e.title} (${time})`;
  });
}

async function sendMorningBriefing(): Promise<void> {
  logger.info('Sending morning briefing...');
  const lines: string[] = ['\u{1F305} *Good morning! Here\'s your daily briefing:*\n'];

  for (const [userKey, name] of [['user1', config.USER1_NAME], ['user2', config.USER2_NAME]] as const) {
    try {
      const events = await getUpcomingEvents(userKey, 1);
      if (events.length) {
        lines.push(`\u{1F4C5} *${name}'s events today:*`);
        lines.push(...formatBriefingEvents(events));
        lines.push('');
      }
    } catch (err) {
      logger.error(`Briefing: calendar fetch failed for ${name}: ${(err as Error).message}`);
    }
  }

  try {
    const tasks = await getTasks('all');
    if (tasks.length) {
      lines.push('\u{2705} *Open tasks:*');
      tasks.forEach((t) => lines.push(`  \u{2022} ${t}`));
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
        `\u{23F0} Reminder for *${reminder.for_whom}*: ${reminder.message}`
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
