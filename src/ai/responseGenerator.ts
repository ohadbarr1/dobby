import { ParsedIntent } from './intentParser';
import { OpenTask } from '../db/repositories/taskRepo';
import { AppleReminder } from '../integrations/appleReminders';

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

    case 'ADD_EVENT': {
      const info = result.data as string | undefined;
      return info
        ? `\u{1F4C5} Added: ${info}`
        : `\u{1F4C5} Added "${intent.title}" to the calendar for ${formatDatetime(intent.start)}.`;
    }

    case 'ADD_SHOPPING': {
      const items = result.data as string[];
      return `\u{1F6D2} Added to your list: ${items.join(', ')}`;
    }

    case 'COMPLETE_SHOPPING': {
      const count = result.data as number;
      return `\u{2705} Marked ${count} item(s) as done!`;
    }

    case 'QUERY_CALENDAR': {
      const data = result.data as string | null;
      return data
        ? `\u{1F4C5} Here's what's coming up:\n${data}`
        : `\u{1F4C5} Nothing coming up \u{2014} enjoy the free time! \u{1F389}`;
    }

    case 'QUERY_SHOPPING': {
      const items = result.data as string[];
      return items.length
        ? `\u{1F6D2} Shopping list:\n${items.map((i) => `\u{2022} ${i}`).join('\n')}`
        : `\u{1F6D2} Shopping list is empty \u{2014} nice work! \u{1F389}`;
    }

    case 'QUERY_TASKS': {
      const { tasks, appleReminders } = result.data as { tasks: OpenTask[]; appleReminders: AppleReminder[] };
      const sections: string[] = [];

      if (tasks.length) {
        const list = tasks
          .map((t, i) => {
            const due = t.due ? ` (due ${formatDate(t.due)})` : '';
            return `${i + 1}. ${t.content}${due}`;
          })
          .join('\n');
        sections.push(`\u{1F4DD} Open tasks:\n${list}`);
      }

      if (appleReminders.length) {
        const list = appleReminders
          .map((r) => {
            const due = r.dueDate ? ` (due ${formatDate(r.dueDate)})` : '';
            return `\u{2022} ${r.name}${due} [${r.list}]`;
          })
          .join('\n');
        sections.push(`\u{1F514} Apple Reminders:\n${list}`);
      }

      if (!sections.length) {
        return `\u{1F4DD} No open tasks \u{2014} you're on top of things! \u{1F64C}`;
      }
      return sections.join('\n\n');
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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}
