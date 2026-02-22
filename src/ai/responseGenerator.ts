import { Intent } from './intentParser';

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

export function generateResponse(intent: Intent, result: ActionResult): string {
  if (!result.ok) {
    return `😕 Something went wrong: ${result.error}`;
  }

  switch (intent.intent) {
    case 'ADD_REMINDER':
      return `✅ Got it! I'll remind ${intent.forWhom} about "${intent.message}" on ${formatDatetime(intent.datetime)}.`;

    case 'ADD_EVENT':
      return `📅 Added "${intent.title}" to the calendar for ${formatDatetime(intent.startDatetime)}.`;

    case 'ADD_SHOPPING': {
      const list = intent.items.map((i) => `• ${i}`).join('\n');
      return `🛒 Added to the shopping list:\n${list}`;
    }

    case 'QUERY_CALENDAR': {
      const data = result.data as string | undefined;
      return data ? `📅 Here's what's coming up:\n${data}` : `📅 Nothing on the calendar for that period.`;
    }

    case 'QUERY_TASKS': {
      const data = result.data as string | undefined;
      return data ? `✅ Here are your tasks:\n${data}` : `✅ No tasks found.`;
    }

    case 'CHITCHAT':
      return intent.reply;
  }
}

function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
