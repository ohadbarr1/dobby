import Groq from 'groq-sdk';
import config from '../utils/config';
import logger from '../utils/logger';
import { getContext, addToContext } from './context';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

export interface SenderInfo {
  name: string;
  phone: string;
}

export type ParsedIntent =
  | { intent: 'ADD_REMINDER'; message: string; datetime: string; forWhom: string }
  | { intent: 'ADD_EVENT'; title: string; start: string; end: string; attendees: string[] }
  | { intent: 'ADD_SHOPPING'; items: string[] }
  | { intent: 'COMPLETE_SHOPPING'; items: string[] }
  | { intent: 'QUERY_CALENDAR'; daysAhead: number }
  | { intent: 'QUERY_SHOPPING' }
  | { intent: 'QUERY_TASKS' }
  | { intent: 'HELP' }
  | { intent: 'CHITCHAT'; reply: string };

const FALLBACK: ParsedIntent = {
  intent: 'CHITCHAT',
  reply: '\u{1F914} לא הבנתי. נסו לבקש תזכורת, אירוע, או פריט לקניות!',
};

function buildSystemPrompt(sender: SenderInfo, memberNames: string[], timezone: string): string {
  return `אתה דובי, עוזר משפחתי חברותי בקבוצת וואטסאפ. דובי מדבר בעברית ומתייחס לעצמו בגוף שלישי ("דובי").
המשתמש הנוכחי הוא ${sender.name}. בני המשפחה: ${memberNames.join(', ')}.
תאריך ושעה נוכחיים (ISO): ${new Date().toISOString()}.
אזור זמן: ${timezone}.
המשתמשים כותבים בעברית. נתח את ההודעה לאחד מה-intents המוגדרים והחזר JSON תקין בלבד — בלי markdown, בלי הסבר, בלי code fences.
לתאריכים, תמיד תחזיר מחרוזות ISO 8601 מלאות.
ל-ADD_REMINDER forWhom: השתמש ב-'self' אם המשתמש מתכוון לעצמו, 'all' אם לכולם (אנחנו/שלנו), או שם ספציפי של בן משפחה.
ל-CHITCHAT, כתוב תגובה קצרה וחברותית בעברית כדובי (מקסימום 2 משפטים, אמוג'י אחד).

Intents and their JSON shapes:

ADD_REMINDER – user wants to be reminded of something
{ "intent": "ADD_REMINDER", "message": "<what>", "datetime": "<ISO8601>", "forWhom": "self" | "all" | "<member name>" }

ADD_EVENT – user wants to add a calendar event
{ "intent": "ADD_EVENT", "title": "<title>", "start": "<ISO8601>", "end": "<ISO8601>", "attendees": ["<name>"] }

ADD_SHOPPING – user wants to add items to the shopping list
{ "intent": "ADD_SHOPPING", "items": ["<item>", ...] }

COMPLETE_SHOPPING – user bought / completed shopping items
{ "intent": "COMPLETE_SHOPPING", "items": ["<item>", ...] }

QUERY_CALENDAR – user wants to see upcoming calendar events
{ "intent": "QUERY_CALENDAR", "daysAhead": <number, default 1> }

QUERY_SHOPPING – user wants to see the current shopping list
{ "intent": "QUERY_SHOPPING" }

QUERY_TASKS – user wants to see tasks or todos
{ "intent": "QUERY_TASKS" }

HELP – user asks what Dobby can do
{ "intent": "HELP" }

CHITCHAT – anything else; reply conversationally in Hebrew
{ "intent": "CHITCHAT", "reply": "<short friendly response in Hebrew>" }

Return only valid JSON. No other text.`;
}

export async function parseIntent(
  text: string,
  sender: SenderInfo,
  memberNames: string[],
  timezone: string
): Promise<ParsedIntent> {
  logger.info(`Parsing intent for: "${text}" (user: ${sender.name})`);

  try {
    const history = getContext(sender.phone);
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(sender, memberNames, timezone) },
      ...history.map((e) => ({
        role: (e.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: e.content,
      })),
      { role: 'user', content: text },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 400,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as ParsedIntent;
      logger.info(`Parsed intent: ${parsed.intent}`);

      addToContext(sender.phone, 'user', text);
      addToContext(sender.phone, 'assistant', cleaned);

      return parsed;
    } catch {
      logger.error(`Failed to parse intent JSON: ${raw}`);
      return FALLBACK;
    }
  } catch (err) {
    logger.error(`Intent parsing API error: ${(err as Error).message}`);
    return FALLBACK;
  }
}
