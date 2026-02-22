import { getMergedEvents, CalendarEvent } from '../integrations/googleCalendar';
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
    const events = await getMergedEvents(1);

    const lines: string[] = ['\u{2600}\u{FE0F} Good morning! Here\'s your day:\n'];

    if (events.length) {
      lines.push(...events.map(formatBriefingEvent));
    } else {
      lines.push('No events today \u{2014} enjoy the free time! \u{1F389}');
    }

    await sendToGroup(lines.join('\n'));
    logger.info('Daily briefing sent');
  } catch (err) {
    logger.error(`Daily briefing failed: ${(err as Error).message}`);
  }
}
