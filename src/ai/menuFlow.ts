import Groq from 'groq-sdk';
import config from '../utils/config';
import { ParsedIntent } from './intentParser';
import { FamilyContext } from '../types/family';
import logger from '../utils/logger';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

const FLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface ActiveFlow {
  type: 'ADD_REMINDER' | 'ADD_EVENT';
  step: number;
  collectedData: Record<string, string>;
  startedAt: number;
}

const flowMap = new Map<string, ActiveFlow>();

export function getActiveFlow(phone: string): ActiveFlow | null {
  const flow = flowMap.get(phone);
  if (!flow) return null;

  if (Date.now() - flow.startedAt > FLOW_TIMEOUT_MS) {
    flowMap.delete(phone);
    return null;
  }

  return flow;
}

export function startFlow(phone: string, type: 'ADD_REMINDER' | 'ADD_EVENT'): string {
  const flow: ActiveFlow = {
    type,
    step: 0,
    collectedData: {},
    startedAt: Date.now(),
  };
  flowMap.set(phone, flow);

  if (type === 'ADD_REMINDER') {
    return '🔔 מה להזכיר?';
  }
  return '📅 שם האירוע?';
}

export function cancelFlow(phone: string): void {
  flowMap.delete(phone);
}

export async function advanceFlow(
  phone: string,
  input: string,
  ctx: FamilyContext
): Promise<{ done: boolean; response?: string; intent?: ParsedIntent }> {
  const flow = getActiveFlow(phone);
  if (!flow) {
    return { done: true, response: 'אין תהליך פעיל. שלחו 7 לתפריט.' };
  }

  if (flow.type === 'ADD_REMINDER') {
    return advanceReminderFlow(phone, flow, input, ctx);
  }

  return advanceEventFlow(phone, flow, input, ctx);
}

async function advanceReminderFlow(
  phone: string,
  flow: ActiveFlow,
  input: string,
  ctx: FamilyContext
): Promise<{ done: boolean; response?: string; intent?: ParsedIntent }> {
  switch (flow.step) {
    case 0:
      // User provides what to remind
      flow.collectedData.message = input.trim();
      flow.step = 1;
      return { done: false, response: '⏰ מתי? (למשל: מחר ב-15:00, עוד שעה)' };

    case 1: {
      // User provides when — parse natural Hebrew time
      const datetime = await parseHebrewTime(input, ctx.family.timezone);
      if (!datetime) {
        return { done: false, response: '❌ לא הצלחתי להבין את הזמן. נסו שוב (למשל: מחר ב-15:00)' };
      }
      flow.collectedData.datetime = datetime;
      flow.step = 2;
      return { done: false, response: '👤 למי? (1=לי, 2=לכולם)' };
    }

    case 2: {
      // User provides for whom
      const forWhom = input.trim() === '2' ? 'all' : 'self';
      flowMap.delete(phone);

      const intent: ParsedIntent = {
        intent: 'ADD_REMINDER',
        message: flow.collectedData.message,
        datetime: flow.collectedData.datetime,
        forWhom,
      };
      return { done: true, intent };
    }

    default:
      flowMap.delete(phone);
      return { done: true, response: 'שגיאה בתהליך. שלחו 7 לתפריט.' };
  }
}

async function advanceEventFlow(
  phone: string,
  flow: ActiveFlow,
  input: string,
  ctx: FamilyContext
): Promise<{ done: boolean; response?: string; intent?: ParsedIntent }> {
  switch (flow.step) {
    case 0:
      // User provides event title
      flow.collectedData.title = input.trim();
      flow.step = 1;
      return { done: false, response: '📅 תאריך ושעת התחלה? (למשל: יום ראשון 10:00)' };

    case 1: {
      // User provides start time
      const start = await parseHebrewTime(input, ctx.family.timezone);
      if (!start) {
        return { done: false, response: '❌ לא הצלחתי להבין את הזמן. נסו שוב (למשל: יום ראשון 10:00)' };
      }
      flow.collectedData.start = start;
      flow.step = 2;
      return { done: false, response: '🕐 שעת סיום? (למשל: 11:00)' };
    }

    case 2: {
      // User provides end time
      const end = await parseHebrewTime(input, ctx.family.timezone);
      if (!end) {
        return { done: false, response: '❌ לא הצלחתי להבין את הזמן. נסו שוב (למשל: 11:00)' };
      }
      flowMap.delete(phone);

      const intent: ParsedIntent = {
        intent: 'ADD_EVENT',
        title: flow.collectedData.title,
        start: flow.collectedData.start,
        end,
        attendees: [],
      };
      return { done: true, intent };
    }

    default:
      flowMap.delete(phone);
      return { done: true, response: 'שגיאה בתהליך. שלחו 7 לתפריט.' };
  }
}

async function parseHebrewTime(input: string, timezone: string): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You convert Hebrew time descriptions to ISO 8601 datetime strings.
Current datetime: ${now}
Timezone: ${timezone}
Return ONLY the ISO 8601 string, nothing else. No quotes, no explanation.
If you cannot parse the input, return exactly: INVALID`,
        },
        { role: 'user', content: input },
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';
    if (raw === 'INVALID' || !raw) return null;

    // Validate it's a parseable date
    const date = new Date(raw);
    if (isNaN(date.getTime())) return null;

    return raw;
  } catch (err) {
    logger.error(`parseHebrewTime error: ${(err as Error).message}`);
    return null;
  }
}
