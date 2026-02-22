import { google, calendar_v3 } from 'googleapis';
import { FamilyMember } from '../types/family';
import config from '../utils/config';
import logger from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  calendarOwner: string;
}

function getOAuth2Client(member: FamilyMember) {
  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: member.googleRefreshToken });
  return oauth2Client;
}

function parseEvent(item: calendar_v3.Schema$Event, ownerName: string): CalendarEvent {
  const isAllDay = !item.start?.dateTime;
  return {
    id: item.iCalUID || item.id || '',
    title: item.summary || '(No title)',
    start: new Date(item.start?.dateTime || item.start?.date || ''),
    end: new Date(item.end?.dateTime || item.end?.date || ''),
    isAllDay,
    calendarOwner: ownerName,
  };
}

export async function getUpcomingEvents(member: FamilyMember, daysAhead = 1): Promise<CalendarEvent[]> {
  if (!member.googleRefreshToken || !member.googleCalendarId) return [];

  const auth = getOAuth2Client(member);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);

  try {
    const response = await calendar.events.list({
      calendarId: member.googleCalendarId,
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map((item) => parseEvent(item, member.name));
  } catch (err) {
    logger.error(`Google Calendar getUpcomingEvents error (${member.name}): ${(err as Error).message}`);
    throw err;
  }
}

export async function createEvent(
  member: FamilyMember,
  event: Omit<CalendarEvent, 'id' | 'calendarOwner'>
): Promise<CalendarEvent> {
  if (!member.googleRefreshToken || !member.googleCalendarId) {
    throw new Error(`Calendar not connected for ${member.name}`);
  }

  const auth = getOAuth2Client(member);
  const calendar = google.calendar({ version: 'v3', auth });

  const requestBody: calendar_v3.Schema$Event = {
    summary: event.title,
    start: event.isAllDay
      ? { date: event.start.toISOString().split('T')[0] }
      : { dateTime: event.start.toISOString() },
    end: event.isAllDay
      ? { date: event.end.toISOString().split('T')[0] }
      : { dateTime: event.end.toISOString() },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: member.googleCalendarId,
      requestBody,
    });
    logger.info(`Created calendar event: ${event.title} (${member.name})`);
    return {
      id: response.data.iCalUID || response.data.id || '',
      title: event.title,
      start: event.start,
      end: event.end,
      isAllDay: event.isAllDay,
      calendarOwner: member.name,
    };
  } catch (err) {
    logger.error(`Google Calendar createEvent error (${member.name}): ${(err as Error).message}`);
    throw err;
  }
}

export async function getMergedEvents(members: FamilyMember[], daysAhead = 1): Promise<CalendarEvent[]> {
  const results = await Promise.all(
    members.map((m) =>
      getUpcomingEvents(m, daysAhead).catch((err) => {
        logger.error(`Failed to fetch calendar for ${m.name}: ${(err as Error).message}`);
        return [] as CalendarEvent[];
      })
    )
  );

  const all = results.flat();

  // Deduplicate by iCalUID (or fall back to title+time)
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    const key = e.id || `${e.title}|${e.start.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => a.start.getTime() - b.start.getTime());
  return deduped;
}
