import { ParsedIntent } from './intentParser';
import { FamilyContext } from '../types/family';
import { updateFamily } from '../db/repositories/familyRepo';
import logger from '../utils/logger';

export function parseCommand(text: string, ctx: FamilyContext): ParsedIntent | null {
  const trimmed = text.trim();

  // Help / menu
  if (trimmed === '7' || trimmed === 'עזרה' || trimmed === 'תפריט') {
    return { intent: 'HELP' };
  }

  // Query shopping
  if (trimmed === '1' || trimmed === 'קניות' || trimmed === 'רשימת קניות') {
    return { intent: 'QUERY_SHOPPING' };
  }

  // Query tasks
  if (trimmed === '2' || trimmed === 'משימות') {
    return { intent: 'QUERY_TASKS' };
  }

  // Query calendar
  if (trimmed === '3' || trimmed === 'יומן' || trimmed === 'לוח שנה') {
    return { intent: 'QUERY_CALENDAR', daysAhead: 7 };
  }

  // Reminder flow trigger — return null to let messageHandler start menu flow
  if (trimmed === '4' || trimmed === 'תזכורת') {
    return null;
  }

  // Event flow trigger — return null to let messageHandler start menu flow
  if (trimmed === '5' || trimmed === 'אירוע' || trimmed === 'הוסף אירוע') {
    return null;
  }

  // Add shopping items: "6 items..." or "הוסף לקניות items..."
  const addShoppingMatch =
    trimmed.match(/^6\s+(.+)/) || trimmed.match(/^הוסף לקניות\s+(.+)/);
  if (addShoppingMatch) {
    const items = addShoppingMatch[1]
      .split(/[,،וו\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      return { intent: 'ADD_SHOPPING', items };
    }
  }

  // Complete shopping items: "קניתי items..."
  const completeMatch = trimmed.match(/^קניתי\s+(.+)/);
  if (completeMatch) {
    const items = completeMatch[1]
      .split(/[,،וו\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      return { intent: 'COMPLETE_SHOPPING', items };
    }
  }

  // Mode toggle — these are async but we handle them specially
  if (trimmed === 'מצב חכם') {
    return { intent: 'CHITCHAT', reply: '__TOGGLE_AI_ON__' } as ParsedIntent;
  }

  if (trimmed === 'מצב רגיל') {
    return { intent: 'CHITCHAT', reply: '__TOGGLE_AI_OFF__' } as ParsedIntent;
  }

  // No match
  return null;
}

/**
 * Returns true if the command is a menu flow trigger ("4"/"תזכורת" or "5"/"אירוע"/"הוסף אירוע").
 */
export function isFlowTrigger(text: string): 'ADD_REMINDER' | 'ADD_EVENT' | null {
  const trimmed = text.trim();
  if (trimmed === '4' || trimmed === 'תזכורת') return 'ADD_REMINDER';
  if (trimmed === '5' || trimmed === 'אירוע' || trimmed === 'הוסף אירוע') return 'ADD_EVENT';
  return null;
}

/**
 * Handle mode toggle side-effect. Returns the user-facing message.
 */
export async function handleModeToggle(
  intent: ParsedIntent,
  ctx: FamilyContext
): Promise<string | null> {
  if (intent.intent !== 'CHITCHAT') return null;

  if (intent.reply === '__TOGGLE_AI_ON__') {
    await updateFamily(ctx.family.id, { aiMode: true });
    ctx.family.aiMode = true;
    logger.info(`Family ${ctx.family.id} switched to AI mode`);
    return '🤖 מצב חכם הופעל — דובי ישתמש ב-AI לפענוח הודעות.';
  }

  if (intent.reply === '__TOGGLE_AI_OFF__') {
    await updateFamily(ctx.family.id, { aiMode: false });
    ctx.family.aiMode = false;
    logger.info(`Family ${ctx.family.id} switched to non-AI mode`);
    return '📋 מצב רגיל הופעל — שלחו 7 לתפריט הפקודות.';
  }

  return null;
}
