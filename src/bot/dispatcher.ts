import { ParsedIntent, SenderInfo } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { addReminder } from '../db/database';
import { handleAddEvent, handleQueryCalendar } from '../handlers/calendarHandler';
import { handleAddShopping, handleCompleteShopping, handleQueryShopping } from '../handlers/shoppingHandler';
import { handleQueryTasks } from '../handlers/taskHandler';
import config from '../utils/config';
import logger from '../utils/logger';

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

      case 'ADD_EVENT':
        return await handleAddEvent(intent, sender);

      case 'QUERY_CALENDAR':
        return await handleQueryCalendar(intent);

      case 'ADD_SHOPPING':
        return await handleAddShopping(intent);

      case 'COMPLETE_SHOPPING':
        return await handleCompleteShopping(intent);

      case 'QUERY_SHOPPING':
        return await handleQueryShopping();

      case 'QUERY_TASKS':
        return await handleQueryTasks();

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
