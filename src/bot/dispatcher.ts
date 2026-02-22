import { ParsedIntent, SenderInfo } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { addReminder } from '../db/database';
import { getEvents, addEvent } from '../integrations/googleCalendar';
import { addShoppingItems, getShoppingItems, getTasks } from '../integrations/todoist';
import config from '../utils/config';
import logger from '../utils/logger';

function getUserCalendar(sender: SenderInfo): { calendarId: string; refreshToken: string } {
  if (sender.phone === config.USER1_PHONE) {
    return {
      calendarId: config.GOOGLE_CALENDAR_ID_USER1,
      refreshToken: config.GOOGLE_REFRESH_TOKEN_USER1,
    };
  }
  return {
    calendarId: config.GOOGLE_CALENDAR_ID_USER2,
    refreshToken: config.GOOGLE_REFRESH_TOKEN_USER2,
  };
}

function formatEvents(events: { title: string; start: string }[]): string {
  return events
    .map(
      (e) =>
        `\u{2022} ${e.title} \u{2014} ${new Date(e.start).toLocaleString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`
    )
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
        const cal = getUserCalendar(sender);
        await addEvent(cal.calendarId, cal.refreshToken, intent.title, intent.start, intent.end);
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
        const cal = getUserCalendar(sender);
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + intent.daysAhead);
        const events = await getEvents(cal.calendarId, cal.refreshToken, now.toISOString(), end.toISOString());
        return { success: true, data: events.length ? formatEvents(events) : null };
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
