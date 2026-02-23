import { getMergedEvents, CalendarEvent } from '../integrations/appleCalendar';
import { Family, FamilyMember } from '../types/family';
import * as taskRepo from '../db/repositories/taskRepo';
import * as familyRepo from '../db/repositories/familyRepo';
import * as memberRepo from '../db/repositories/memberRepo';
import { sendToGroup } from '../bot/whatsappClient';
import { t } from '../i18n';
import logger from '../utils/logger';

function formatBriefingEvent(e: CalendarEvent): string {
  if (e.isAllDay) {
    return `  \u{2022} ${e.title} (${e.calendarOwner}) \u{2014} ${t('briefingAllDay')}`;
  }
  const time = e.start.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `  \u{2022} ${e.title} (${e.calendarOwner}) \u{2014} ${time}`;
}

async function sendBriefingForFamily(family: Family, members: FamilyMember[]): Promise<void> {
  try {
    const [events, tasks] = await Promise.all([
      getMergedEvents(members, 1).catch((err) => {
        logger.error(`Briefing calendar error (family ${family.id}): ${(err as Error).message}`);
        return [] as CalendarEvent[];
      }),
      taskRepo.getOpenTasks(family.id).catch((err) => {
        logger.error(`Briefing tasks error (family ${family.id}): ${(err as Error).message}`);
        return [];
      }),
    ]);

    const lines: string[] = [t('briefingGreeting')];

    // Calendar section
    if (events.length) {
      lines.push(t('briefingEventsHeader'));
      lines.push(...events.map(formatBriefingEvent));
    } else {
      lines.push(t('briefingNoEvents'));
    }

    // Tasks section
    lines.push('');
    if (tasks.length) {
      lines.push(t('briefingTasksHeader'));
      tasks.forEach((task) => {
        const due = task.due ? ` (${task.due})` : '';
        lines.push(`  \u{2022} ${task.content}${due}`);
      });
    } else {
      lines.push(t('briefingNoTasks'));
    }

    await sendToGroup(family.whatsappGroupId, lines.join('\n'));
    logger.info(`Daily briefing sent for family ${family.id}`);
  } catch (err) {
    logger.error(`Daily briefing failed for family ${family.id}: ${(err as Error).message}`);
  }
}

function getCurrentTimeInTimezone(timezone: string): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute };
}

export async function sendDailyBriefing(): Promise<void> {
  try {
    const families = await familyRepo.getAllFamilies();

    for (const family of families) {
      const { hour, minute } = getCurrentTimeInTimezone(family.timezone);
      if (hour === family.briefingHour && minute === family.briefingMinute) {
        const members = await memberRepo.getMembersByFamilyId(family.id);
        await sendBriefingForFamily(family, members);
      }
    }
  } catch (err) {
    logger.error(`Daily briefing check failed: ${(err as Error).message}`);
  }
}
