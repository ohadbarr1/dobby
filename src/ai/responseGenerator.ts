import { ParsedIntent } from './intentParser';

export interface ActionResult {
  success: boolean;
  data?: any;
  errorMsg?: string;
}

const HELP_TEXT = `\u{1F44B} Here's what I can do:

\u{2022} *Add a reminder* \u{2014} "remind me to call mom tomorrow at 3pm"
\u{2022} *Add an event* \u{2014} "add meeting with Dan on Sunday 10am-11am"
\u{2022} *Shopping list* \u{2014} "add milk and eggs" / "what's on the shopping list?" / "bought milk"
\u{2022} *Calendar* \u{2014} "what's on the calendar this week?"
\u{2022} *Tasks* \u{2014} "show tasks"

Just send a message and I'll figure it out! \u{1F916}`;

export function generateResponse(intent: ParsedIntent, result: ActionResult): string {
  if (!result.success) {
    return `\u{274C} ${result.errorMsg || 'Something went wrong'}`;
  }

  switch (intent.intent) {
    case 'ADD_REMINDER':
      return `\u{2705} Got it! I'll remind about "${intent.message}" on ${formatDatetime(intent.datetime)}.`;

    case 'ADD_EVENT':
      return `\u{1F4C5} Added "${intent.title}" to the calendar for ${formatDatetime(intent.start)}.`;

    case 'ADD_SHOPPING':
      return `\u{1F6D2} Added to your list: ${intent.items.join(', ')}`;

    case 'COMPLETE_SHOPPING':
      return `\u{2705} Marked as bought: ${intent.items.join(', ')}`;

    case 'QUERY_CALENDAR': {
      const data = result.data as string | undefined;
      return data
        ? `\u{1F4C5} Here's what's coming up:\n${data}`
        : `\u{1F4C5} Nothing coming up \u{2014} enjoy the free time! \u{1F389}`;
    }

    case 'QUERY_SHOPPING': {
      const data = result.data as string | undefined;
      return data
        ? `\u{1F6D2} Shopping list:\n${data}`
        : `\u{1F6D2} Shopping list is empty!`;
    }

    case 'QUERY_TASKS': {
      const data = result.data as string | undefined;
      return data
        ? `\u{2705} Here are your tasks:\n${data}`
        : `\u{2705} No tasks found.`;
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
