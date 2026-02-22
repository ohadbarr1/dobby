import { ParsedIntent, SenderInfo } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { addReminder } from '../db/database';
import { createEvent, getUpcomingEvents, CalendarEvent } from '../integrations/googleCalendar';
import { addShoppingItems, getShoppingItems, getTasks } from '../integrations/todoist';
import config from '../utils/config';
import logger from '../utils/logger';

type UserKey = 'user1' | 'user2';

function getUserKey(sender: SenderInfo): UserKey {
  return sender.phone === config.USER1_PHONE ? 'user1' : 'user2';
}

function formatCalendarEvents(events: CalendarEvent[]): string {
  return events
    .map((e) => {
      const owner = e.calendarOwner === 'user1' ? config.USER1_NAME : config.USER2_NAME;
      const time = e.isAllDay
        ? 'All day'
        : e.start.toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
      return `\u{2022} ${e.title} \u{2014} ${time} (${owner})`;
    })
    .join('\n');
}

export async function dispatch(intent: ParsedIntent, sender: SenderInfo): Promise<ActionResult> {
  try {
    switch (intent.intent) {
      case 'ADD_REMINDER': {
        const forWhom =
          intent.forWhom === 'user1' ? config.USER1_NAME
          : intent.forWhom === 'user2' ? config.USER2_NAME
          : `${config.USER1_NAME} & ${config.USER2_NAME}`;
        addReminder(forWhom, intent.datetime, intent.message);
        return { success: true };
      }

      case 'ADD_EVENT': {
        const userKey = getUserKey(sender);
        await createEvent(userKey, {
          title: intent.title,
          start: new Date(intent.start),
          end: new Date(intent.end),
          isAllDay: false,
        });
        return { success: true };
      }

      case 'ADD_SHOPPING': {
        await addShoppingItems(intent.items);
        return { success: true };
      }

      case 'COMPLETE_SHOPPING': {
        // TODO: implement completing items in Todoist
        return { success: true };
      }

      case 'QUERY_CALENDAR': {
        const userKey = getUserKey(sender);
        const events = await getUpcomingEvents(userKey, intent.daysAhead);
        return { success: true, data: events.length ? formatCalendarEvents(events) : null };
      }

      case 'QUERY_SHOPPING': {
        const items = await getShoppingItems();
        return { success: true, data: items.length ? items.map((i) => `\u{2022} ${i}`).join('\n') : null };
      }

      case 'QUERY_TASKS': {
        const tasks = await getTasks('all');
        return { success: true, data: tasks.length ? tasks.map((t) => `\u{2022} ${t}`).join('\n') : null };
      }

      case 'HELP':
        return { success: true };

      case 'CHITCHAT':
        return { success: true };
    }
  } catch (err) {
    logger.error(`Dispatch error for ${intent.intent}: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Something went wrong \u{1F648}' };
  }
}
