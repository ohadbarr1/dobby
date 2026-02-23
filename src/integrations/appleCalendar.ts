import { execFile } from 'child_process';
import { FamilyMember } from '../types/family';
import logger from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  calendarOwner: string;
}

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`osascript error: ${err.message} — ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function getUpcomingEvents(_member: FamilyMember, daysAhead = 1): Promise<CalendarEvent[]> {
  return getUpcomingEventsRaw(daysAhead);
}

async function getUpcomingEventsRaw(daysAhead: number): Promise<CalendarEvent[]> {
  // AppleScript that collects events from all calendars within the date range
  // Returns pipe-delimited rows: summary|startDate|endDate|allDay|calendarName
  const script = `
    set nowDate to current date
    set endDate to nowDate + (${daysAhead} * days)
    set output to ""
    tell application "Calendar"
      repeat with cal in calendars
        set calName to name of cal
        try
          set evts to (every event of cal whose start date >= nowDate and start date <= endDate)
          repeat with e in evts
            set s to start date of e
            set f to end date of e
            set t to summary of e
            set ad to allday event of e
            set output to output & t & "|" & (s as «class isot» as string) & "|" & (f as «class isot» as string) & "|" & ad & "|" & calName & linefeed
          end repeat
        end try
      end repeat
    end tell
    return output
  `;

  try {
    const raw = await runOsascript(script);
    if (!raw) return [];

    const events: CalendarEvent[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 5) continue;

      const [title, startStr, endStr, allDayStr, calName] = parts;
      const start = parseAppleDate(startStr);
      const end = parseAppleDate(endStr);
      if (!start || !end) continue;

      events.push({
        id: `${title}|${start.getTime()}`,
        title: title || '(No title)',
        start,
        end,
        isAllDay: allDayStr.trim() === 'true',
        calendarOwner: calName.trim(),
      });
    }

    events.sort((a, b) => a.start.getTime() - b.start.getTime());
    return events;
  } catch (err) {
    logger.error(`Apple Calendar getUpcomingEvents error: ${(err as Error).message}`);
    return [];
  }
}

/** Parse AppleScript ISO date string (format: 2026-02-23T140000) into a Date */
function parseAppleDate(str: string): Date | null {
  try {
    const s = str.trim();
    // AppleScript «class isot» gives e.g. "2026-02-23T140000" — insert colons for time
    if (s.length === 17 && s[10] === 'T') {
      const datePart = s.slice(0, 10);
      const hh = s.slice(11, 13);
      const mm = s.slice(13, 15);
      const ss = s.slice(15, 17);
      return new Date(`${datePart}T${hh}:${mm}:${ss}`);
    }
    // Fallback: try standard parsing
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export async function createEvent(
  _member: FamilyMember,
  event: Omit<CalendarEvent, 'id' | 'calendarOwner'>
): Promise<CalendarEvent> {
  const startStr = formatAppleDate(event.start);
  const endStr = formatAppleDate(event.end);
  const escaped = event.title.replace(/"/g, '\\"');

  const script = `
    tell application "Calendar"
      set targetCal to first calendar whose writable is true
      set newEvent to make new event at end of events of targetCal with properties {summary:"${escaped}", start date:date "${startStr}", end date:date "${endStr}"}
    end tell
    return "ok"
  `;

  try {
    await runOsascript(script);
    logger.info(`Created Apple Calendar event: ${event.title}`);
    return {
      id: `${event.title}|${event.start.getTime()}`,
      title: event.title,
      start: event.start,
      end: event.end,
      isAllDay: event.isAllDay,
      calendarOwner: 'Apple Calendar',
    };
  } catch (err) {
    logger.error(`Apple Calendar createEvent error: ${(err as Error).message}`);
    throw err;
  }
}

/** Format a Date into a string AppleScript's `date` command understands */
function formatAppleDate(d: Date): string {
  // AppleScript parses dates in the system locale format.
  // We use a verbose form that works broadly: "February 23, 2026 2:30:00 PM"
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export async function getMergedEvents(members: FamilyMember[], daysAhead = 1): Promise<CalendarEvent[]> {
  // Apple Calendar already returns events from all calendars, so we ignore per-member tokens
  return getUpcomingEventsRaw(daysAhead);
}
