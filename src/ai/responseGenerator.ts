import { ParsedIntent } from './intentParser';

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

const HELP_TEXT = `👋 Here's what I can do:

• *Add a reminder* — "remind me to call mom tomorrow at 3pm"
• *Add an event* — "add meeting with Dan on Sunday 10am-11am"
• *Shopping list* — "add milk and eggs" / "what's on the shopping list?" / "bought milk"
• *Calendar* — "what's on the calendar this week?"
• *Tasks* — "show tasks"

Just send a message and I'll figure it out! 🤖`;

export function generateResponse(intent: ParsedIntent, result: ActionResult): string {
  if (!result.ok) {
    return `😕 Something went wrong: ${result.error}`;
  }

  switch (intent.intent) {
    case 'ADD_REMINDER':
      return `✅ Got it! I'll remind about "${intent.message}" on ${formatDatetime(intent.datetime)}.`;

    case 'ADD_EVENT':
      return `📅 Added "${intent.title}" to the calendar for ${formatDatetime(intent.start)}.`;

    case 'ADD_SHOPPING': {
      const list = intent.items.map((i) => `• ${i}`).join('\n');
      return `🛒 Added to the shopping list:\n${list}`;
    }

    case 'COMPLETE_SHOPPING': {
      const list = intent.items.map((i) => `• ${i}`).join('\n');
      return `✅ Marked as bought:\n${list}`;
    }

    case 'QUERY_CALENDAR': {
      const data = result.data as string | undefined;
      return data ? `📅 Here's what's coming up:\n${data}` : `📅 Nothing on the calendar for that period.`;
    }

    case 'QUERY_SHOPPING': {
      const data = result.data as string | undefined;
      return data ? `🛒 Shopping list:\n${data}` : `🛒 Shopping list is empty!`;
    }

    case 'QUERY_TASKS': {
      const data = result.data as string | undefined;
      return data ? `✅ Here are your tasks:\n${data}` : `✅ No tasks found.`;
    }

    case 'HELP':
      return HELP_TEXT;

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
