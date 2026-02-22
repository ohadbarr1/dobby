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
  reply: "Sorry, I didn't catch that. Try asking me to add a reminder, event, or shopping item! \u{1F914}",
};

function buildSystemPrompt(sender: SenderInfo, memberNames: string[], timezone: string): string {
  return `You are Dobby, a friendly family assistant in a WhatsApp group.
The current user is ${sender.name}. Family members: ${memberNames.join(', ')}.
Current datetime (ISO): ${new Date().toISOString()}.
Timezone: ${timezone}.
Parse the user message into exactly one of the defined intents and return valid JSON only — no markdown, no explanation, no code fences.
For datetimes, always output full ISO 8601 strings.
For ADD_REMINDER forWhom: use 'self' if the user means themselves, 'all' if they mean everyone (us/we), or the specific member name.
For CHITCHAT, set reply to a short friendly response as Dobby (max 2 sentences, 1 emoji).

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

CHITCHAT – anything else; reply conversationally
{ "intent": "CHITCHAT", "reply": "<short friendly response>" }

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
