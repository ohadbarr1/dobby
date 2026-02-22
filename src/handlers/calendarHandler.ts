import { ParsedIntent, SenderInfo } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { createEvent, getMergedEvents, CalendarEvent } from '../integrations/googleCalendar';
import config from '../utils/config';
import logger from '../utils/logger';

type AddEventIntent = Extract<ParsedIntent, { intent: 'ADD_EVENT' }>;
type QueryCalendarIntent = Extract<ParsedIntent, { intent: 'QUERY_CALENDAR' }>;
type UserKey = 'user1' | 'user2';

function getUserKey(sender: SenderInfo): UserKey {
  return sender.phone === config.USER1_PHONE ? 'user1' : 'user2';
}

function formatEvent(e: CalendarEvent): string {
  const owner = e.calendarOwner === 'user1' ? config.USER1_NAME : config.USER2_NAME;
  if (e.isAllDay) {
    const day = e.start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `\u{1F4C5} ${day} \u{2014} ${e.title} (${owner}) [all day]`;
  }
  const datetime = e.start.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `\u{1F4C5} ${datetime} \u{2014} ${e.title} (${owner})`;
}

export async function handleAddEvent(intent: AddEventIntent, sender: SenderInfo): Promise<ActionResult> {
  try {
    // Decide which calendars to write to
    const targets: UserKey[] = [];
    const attendeeNames = intent.attendees.map((a) => a.toLowerCase());

    const bothMentioned =
      attendeeNames.length === 0 ||
      (attendeeNames.includes(config.USER1_NAME.toLowerCase()) &&
        attendeeNames.includes(config.USER2_NAME.toLowerCase()));

    if (bothMentioned) {
      targets.push('user1', 'user2');
    } else {
      targets.push(getUserKey(sender));
    }

    const eventData = {
      title: intent.title,
      start: new Date(intent.start),
      end: new Date(intent.end),
      isAllDay: false,
    };

    await Promise.all(targets.map((t) => createEvent(t, eventData)));

    const datetime = eventData.start.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    logger.info(`Created event "${intent.title}" for ${targets.join(', ')}`);
    return { success: true, data: `${intent.title} on ${datetime}` };
  } catch (err) {
    logger.error(`handleAddEvent error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to create calendar event \u{1F648}' };
  }
}

export async function handleQueryCalendar(intent: QueryCalendarIntent): Promise<ActionResult> {
  try {
    const events = await getMergedEvents(intent.daysAhead);

    if (!events.length) {
      return { success: true, data: null };
    }

    const formatted = events.map(formatEvent).join('\n');
    return { success: true, data: formatted };
  } catch (err) {
    logger.error(`handleQueryCalendar error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to fetch calendar \u{1F648}' };
  }
}
