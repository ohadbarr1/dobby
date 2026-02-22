import Anthropic from '@anthropic-ai/sdk';
import config from '../utils/config';
import logger from '../utils/logger';

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export type Intent =
  | { intent: 'ADD_REMINDER'; datetime: string; message: string; forWhom: string }
  | { intent: 'ADD_EVENT'; title: string; startDatetime: string; endDatetime: string; attendees: string[] }
  | { intent: 'ADD_SHOPPING'; items: string[] }
  | { intent: 'QUERY_CALENDAR'; dateRange: { start: string; end: string } }
  | { intent: 'QUERY_TASKS'; filter: string }
  | { intent: 'CHITCHAT'; reply: string };

function buildSystemPrompt(name: string, now: string): string {
  return `You are Dobby, a family assistant bot. Parse the user's message into exactly one of these intents and return JSON only — no markdown, no explanation.

User is: ${name}. Current time: ${now}.

Intents and their JSON shapes:

ADD_REMINDER   – user wants to be reminded of something
{ "intent": "ADD_REMINDER", "datetime": "<ISO8601>", "message": "<what to remind>", "forWhom": "<name>" }

ADD_EVENT      – user wants to add a calendar event
{ "intent": "ADD_EVENT", "title": "<title>", "startDatetime": "<ISO8601>", "endDatetime": "<ISO8601>", "attendees": ["<name>"] }

ADD_SHOPPING   – user wants to add items to the shopping list
{ "intent": "ADD_SHOPPING", "items": ["<item>", ...] }

QUERY_CALENDAR – user wants to know what's on the calendar
{ "intent": "QUERY_CALENDAR", "dateRange": { "start": "<ISO8601>", "end": "<ISO8601>" } }

QUERY_TASKS    – user wants to see tasks or todos
{ "intent": "QUERY_TASKS", "filter": "<description of filter or 'all'>" }

CHITCHAT       – anything else; reply conversationally
{ "intent": "CHITCHAT", "reply": "<short friendly reply>" }

Return only valid JSON. No other text.`;
}

export async function parseIntent(message: string, name: string): Promise<Intent> {
  const now = new Date().toISOString();
  const systemPrompt = buildSystemPrompt(name, now);

  logger.info(`Parsing intent for message: "${message}" (user: ${name})`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  try {
    const parsed = JSON.parse(raw) as Intent;
    logger.info(`Parsed intent: ${parsed.intent}`);
    return parsed;
  } catch {
    logger.error(`Failed to parse intent JSON: ${raw}`);
    // Fall back to CHITCHAT if JSON is malformed
    return { intent: 'CHITCHAT', reply: raw };
  }
}
