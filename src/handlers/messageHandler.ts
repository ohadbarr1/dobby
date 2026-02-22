import { parseIntent, ParsedIntent, SenderInfo } from '../ai/intentParser';
import { generateResponse, ActionResult } from '../ai/responseGenerator';
import { addReminder } from '../db/database';
import { getEvents, addEvent } from '../integrations/googleCalendar';
import { addShoppingItems, getShoppingItems, getTasks } from '../integrations/todoist';
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

  const sender: SenderInfo = { name: user.name, phone };
  const intent: ParsedIntent = await parseIntent(message, sender);

  let result: ActionResult;

  try {
    switch (intent.intent) {
      case 'ADD_REMINDER': {
        const forWhom = intent.forWhom === 'user1' ? config.USER1_NAME
          : intent.forWhom === 'user2' ? config.USER2_NAME
          : `${config.USER1_NAME} & ${config.USER2_NAME}`;
        addReminder(forWhom, intent.datetime, intent.message);
        result = { ok: true };
        break;
      }

      case 'ADD_EVENT': {
        await addEvent(
          user.calendarId,
          user.refreshToken,
          intent.title,
          intent.start,
          intent.end
        );
        result = { ok: true };
        break;
      }

      case 'ADD_SHOPPING': {
        await addShoppingItems(intent.items);
        result = { ok: true };
        break;
      }

      case 'COMPLETE_SHOPPING': {
        // TODO: implement completing items in Todoist
        result = { ok: true };
        break;
      }

      case 'QUERY_CALENDAR': {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + intent.daysAhead);
        const events = await getEvents(
          user.calendarId,
          user.refreshToken,
          now.toISOString(),
          end.toISOString()
        );
        result = { ok: true, data: events.length ? formatEvents(events) : null };
        break;
      }

      case 'QUERY_SHOPPING': {
        const items = await getShoppingItems();
        result = { ok: true, data: items.length ? items.map((i) => `• ${i}`).join('\n') : null };
        break;
      }

      case 'QUERY_TASKS': {
        const tasks = await getTasks('all');
        result = { ok: true, data: tasks.length ? tasks.map((t) => `• ${t}`).join('\n') : null };
        break;
      }

      case 'HELP': {
        result = { ok: true };
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
