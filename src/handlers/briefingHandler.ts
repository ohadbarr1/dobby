import { getMergedEvents, CalendarEvent } from '../integrations/googleCalendar';
import { getOpenTasks } from '../integrations/todoist';
import { sendToGroup } from '../bot/whatsappClient';
import config from '../utils/config';
import logger from '../utils/logger';

function formatBriefingEvent(e: CalendarEvent): string {
  const owner = e.calendarOwner === 'user1' ? config.USER1_NAME : config.USER2_NAME;
  if (e.isAllDay) {
    return `  \u{2022} ${e.title} (${owner}) \u{2014} all day`;
  }
  const time = e.start.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `  \u{2022} ${e.title} (${owner}) \u{2014} ${time}`;
}

export async function sendDailyBriefing(): Promise<void> {
  logger.info('Sending daily briefing...');

  try {
    const [events, tasks] = await Promise.all([
      getMergedEvents(1).catch((err) => {
        logger.error(`Briefing calendar error: ${(err as Error).message}`);
        return [] as CalendarEvent[];
      }),
      getOpenTasks().catch((err) => {
        logger.error(`Briefing tasks error: ${(err as Error).message}`);
        return [];
      }),
    ]);

    const lines: string[] = ['\u{2600}\u{FE0F} Good morning! Here\'s your day:\n'];

    // Calendar section
    if (events.length) {
      lines.push('\u{1F4C5} *Today\'s events:*');
      lines.push(...events.map(formatBriefingEvent));
    } else {
      lines.push('\u{1F4C5} No events today');
    }

    // Tasks section
    lines.push('');
    if (tasks.length) {
      lines.push('\u{1F4DD} *Open tasks:*');
      tasks.forEach((t) => {
        const due = t.due ? ` (due ${t.due})` : '';
        lines.push(`  \u{2022} ${t.content}${due}`);
      });
    } else {
      lines.push('\u{1F4DD} No open tasks \u{2014} enjoy your day!');
    }

    await sendToGroup(lines.join('\n'));
    logger.info('Daily briefing sent');
  } catch (err) {
    logger.error(`Daily briefing failed: ${(err as Error).message}`);
  }
}
