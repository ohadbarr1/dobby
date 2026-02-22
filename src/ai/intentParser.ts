import Anthropic from '@anthropic-ai/sdk';
import config from '../utils/config';
import logger from '../utils/logger';

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export interface SenderInfo {
  name: string;
  phone: string;
}

export type ParsedIntent =
  | { intent: 'ADD_REMINDER'; message: string; datetime: string; forWhom: 'both' | 'user1' | 'user2' }
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

function buildSystemPrompt(sender: SenderInfo): string {
  return `You are Dobby, a friendly family assistant in a WhatsApp group.
The current user is ${sender.name}. Current datetime (ISO): ${new Date().toISOString()}.
Timezone: ${config.TIMEZONE}.
Parse the user message into exactly one of the defined intents and return valid JSON only — no markdown, no explanation.
For datetimes, always output full ISO 8601 strings.
For ADD_REMINDER forWhom: use 'both' if the user says 'us' or 'we', else infer from context.
For CHITCHAT, set reply to a short friendly response as Dobby (max 2 sentences, 1 emoji).

Intents and their JSON shapes:

ADD_REMINDER – user wants to be reminded of something
{ "intent": "ADD_REMINDER", "message": "<what>", "datetime": "<ISO8601>", "forWhom": "both" | "user1" | "user2" }

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

export async function parseIntent(text: string, sender: SenderInfo): Promise<ParsedIntent> {
  logger.info(`Parsing intent for: "${text}" (user: ${sender.name})`);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: buildSystemPrompt(sender),
      messages: [{ role: 'user', content: text }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    try {
      const parsed = JSON.parse(raw) as ParsedIntent;
      logger.info(`Parsed intent: ${parsed.intent}`);
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
