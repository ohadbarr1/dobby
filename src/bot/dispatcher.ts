import { ParsedIntent } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { FamilyContext } from '../types/family';
import * as reminderRepo from '../db/repositories/reminderRepo';
import { handleAddEvent, handleQueryCalendar } from '../handlers/calendarHandler';
import { handleAddShopping, handleCompleteShopping, handleQueryShopping } from '../handlers/shoppingHandler';
import { handleQueryTasks } from '../handlers/taskHandler';
import logger from '../utils/logger';

export async function dispatch(intent: ParsedIntent, ctx: FamilyContext): Promise<ActionResult> {
  try {
    switch (intent.intent) {
      case 'ADD_REMINDER': {
        let forWhom: string;
        if (intent.forWhom === 'self') {
          forWhom = ctx.member.name;
        } else if (intent.forWhom === 'all') {
          forWhom = ctx.allMembers.map((m) => m.name).join(' & ');
        } else {
          forWhom = intent.forWhom;
        }
        await reminderRepo.addReminder(ctx.family.id, forWhom, intent.datetime, intent.message);
        return { success: true };
      }

      case 'ADD_EVENT':
        return await handleAddEvent(intent, ctx);

      case 'QUERY_CALENDAR':
        return await handleQueryCalendar(intent, ctx);

      case 'ADD_SHOPPING':
        return await handleAddShopping(intent, ctx);

      case 'COMPLETE_SHOPPING':
        return await handleCompleteShopping(intent, ctx);

      case 'QUERY_SHOPPING':
        return await handleQueryShopping(ctx);

      case 'QUERY_TASKS':
        return await handleQueryTasks(ctx);

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
