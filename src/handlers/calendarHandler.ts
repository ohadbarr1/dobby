import { ParsedIntent } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { FamilyContext, FamilyMember } from '../types/family';
import { createEvent, getMergedEvents, CalendarEvent } from '../integrations/appleCalendar';
import { t } from '../i18n';
import logger from '../utils/logger';

type AddEventIntent = Extract<ParsedIntent, { intent: 'ADD_EVENT' }>;
type QueryCalendarIntent = Extract<ParsedIntent, { intent: 'QUERY_CALENDAR' }>;

function formatEvent(e: CalendarEvent): string {
  if (e.isAllDay) {
    const day = e.start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `\u{1F4C5} ${day} \u{2014} ${e.title} (${e.calendarOwner}) [${t('calendarAllDay')}]`;
  }
  const datetime = e.start.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `\u{1F4C5} ${datetime} \u{2014} ${e.title} (${e.calendarOwner})`;
}

export async function handleAddEvent(intent: AddEventIntent, ctx: FamilyContext): Promise<ActionResult> {
  try {
    const attendeeNames = intent.attendees.map((a) => a.toLowerCase());

    // Determine target members
    let targets: FamilyMember[];
    if (attendeeNames.length === 0) {
      // No attendees specified — add to all members with connected calendars
      targets = ctx.allMembers.filter((m) => m.googleRefreshToken);
    } else {
      const allMentioned = ctx.allMembers.every((m) =>
        attendeeNames.includes(m.name.toLowerCase())
      );
      if (allMentioned) {
        targets = ctx.allMembers.filter((m) => m.googleRefreshToken);
      } else {
        // Match mentioned members, fall back to sender
        const matched = ctx.allMembers.filter((m) =>
          attendeeNames.includes(m.name.toLowerCase()) && m.googleRefreshToken
        );
        targets = matched.length > 0 ? matched : (ctx.member.googleRefreshToken ? [ctx.member] : []);
      }
    }

    if (targets.length === 0) {
      return { success: false, errorMsg: t('calendarNoConnected') };
    }

    const eventData = {
      title: intent.title,
      start: new Date(intent.start),
      end: new Date(intent.end),
      isAllDay: false,
    };

    await Promise.all(targets.map((m) => createEvent(m, eventData)));

    const datetime = eventData.start.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    logger.info(`Created event "${intent.title}" for ${targets.map((m) => m.name).join(', ')}`);
    return { success: true, data: `${intent.title} on ${datetime}` };
  } catch (err) {
    logger.error(`handleAddEvent error: ${(err as Error).message}`);
    return { success: false, errorMsg: t('calendarCreateFailed') };
  }
}

export async function handleQueryCalendar(intent: QueryCalendarIntent, ctx: FamilyContext): Promise<ActionResult> {
  try {
    const events = await getMergedEvents(ctx.allMembers, intent.daysAhead);

    if (!events.length) {
      return { success: true, data: null };
    }

    const formatted = events.map(formatEvent).join('\n');
    return { success: true, data: formatted };
  } catch (err) {
    logger.error(`handleQueryCalendar error: ${(err as Error).message}`);
    return { success: false, errorMsg: t('calendarFetchFailed') };
  }
}
