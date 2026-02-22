import { parseIntent, Intent } from '../ai/intentParser';
import { generateResponse, ActionResult } from '../ai/responseGenerator';
import { addReminder } from '../db/database';
import { getEvents, addEvent } from '../integrations/googleCalendar';
import { addShoppingItems, getTasks } from '../integrations/todoist';
import config from '../utils/config';
import logger from '../utils/logger';

interface UserConfig {
  name: string;
  refreshToken: string;
  calendarId: string;
}

function getUserConfig(phone: string): UserConfig | null {
  if (phone === config.USER1_PHONE) {
    return {
      name: config.USER1_NAME,
      refreshToken: config.GOOGLE_REFRESH_TOKEN_USER1,
      calendarId: config.GOOGLE_CALENDAR_ID_USER1,
    };
  }
  if (phone === config.USER2_PHONE) {
    return {
      name: config.USER2_NAME,
      refreshToken: config.GOOGLE_REFRESH_TOKEN_USER2,
      calendarId: config.GOOGLE_CALENDAR_ID_USER2,
    };
  }
  return null;
}

function formatEvents(events: { title: string; start: string }[]): string {
  return events
    .map(
      (e) =>
        `• ${e.title} — ${new Date(e.start).toLocaleString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`
    )
    .join('\n');
}

export async function handleMessage(phone: string, message: string): Promise<string> {
  const user = getUserConfig(phone);
  if (!user) {
    logger.warn(`Message from unknown phone: ${phone}`);
    return '';
  }

  let intent: Intent;
  try {
    intent = await parseIntent(message, user.name);
  } catch (err) {
    logger.error(`Intent parsing failed: ${(err as Error).message}`);
    return '😕 Sorry, I had trouble understanding that.';
  }

  let result: ActionResult;

  try {
    switch (intent.intent) {
      case 'ADD_REMINDER': {
        addReminder(intent.forWhom, intent.datetime, intent.message);
        result = { ok: true };
        break;
      }

      case 'ADD_EVENT': {
        await addEvent(
          user.calendarId,
          user.refreshToken,
          intent.title,
          intent.startDatetime,
          intent.endDatetime
        );
        result = { ok: true };
        break;
      }

      case 'ADD_SHOPPING': {
        await addShoppingItems(intent.items);
        result = { ok: true };
        break;
      }

      case 'QUERY_CALENDAR': {
        const events = await getEvents(
          user.calendarId,
          user.refreshToken,
          intent.dateRange.start,
          intent.dateRange.end
        );
        result = { ok: true, data: events.length ? formatEvents(events) : null };
        break;
      }

      case 'QUERY_TASKS': {
        const tasks = await getTasks(intent.filter);
        result = { ok: true, data: tasks.length ? tasks.map((t) => `• ${t}`).join('\n') : null };
        break;
      }

      case 'CHITCHAT': {
        result = { ok: true };
        break;
      }
    }
  } catch (err) {
    logger.error(`Action failed for ${intent.intent}: ${(err as Error).message}`);
    result = { ok: false, error: (err as Error).message };
  }

  return generateResponse(intent, result);
}
