import { ParsedIntent } from './intentParser';
import { OpenTask } from '../db/repositories/taskRepo';
import { AppleReminder } from '../integrations/appleReminders';
import { t } from '../i18n';

export interface ActionResult {
  success: boolean;
  data?: any;
  errorMsg?: string;
}

export function generateResponse(intent: ParsedIntent, result: ActionResult): string {
  if (!result.success) {
    return t('error', { msg: result.errorMsg || t('errorDefault') });
  }

  switch (intent.intent) {
    case 'ADD_REMINDER':
      return t('addReminder', { message: intent.message, datetime: formatDatetime(intent.datetime) });

    case 'ADD_EVENT': {
      const info = result.data as string | undefined;
      return info
        ? t('addEvent', { info })
        : t('addEventFallback', { title: intent.title, datetime: formatDatetime(intent.start) });
    }

    case 'ADD_SHOPPING': {
      const items = result.data as string[];
      return t('addShopping', { items: items.join(', ') });
    }

    case 'COMPLETE_SHOPPING': {
      const count = result.data as number;
      return t('completeShopping', { count });
    }

    case 'QUERY_CALENDAR': {
      const data = result.data as string | null;
      return data
        ? `${t('queryCalendarHeader')}\n${data}`
        : t('queryCalendarEmpty');
    }

    case 'QUERY_SHOPPING': {
      const items = result.data as string[];
      return items.length
        ? `${t('queryShoppingHeader')}\n${items.map((i) => `\u{2022} ${i}`).join('\n')}`
        : t('queryShoppingEmpty');
    }

    case 'QUERY_TASKS': {
      const { tasks, appleReminders } = result.data as { tasks: OpenTask[]; appleReminders: AppleReminder[] };
      const sections: string[] = [];

      if (tasks.length) {
        const list = tasks
          .map((task, i) => {
            const due = task.due ? ` (${formatDate(task.due)})` : '';
            return `${i + 1}. ${task.content}${due}`;
          })
          .join('\n');
        sections.push(`${t('queryTasksHeader')}\n${list}`);
      }

      if (appleReminders.length) {
        const list = appleReminders
          .map((r) => {
            const due = r.dueDate ? ` (${formatDate(r.dueDate)})` : '';
            return `\u{2022} ${r.name}${due} [${r.list}]`;
          })
          .join('\n');
        sections.push(`${t('queryRemindersHeader')}\n${list}`);
      }

      if (!sections.length) {
        return t('queryTasksEmpty');
      }
      return sections.join('\n\n');
    }

    case 'HELP':
      return t('helpText');

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
