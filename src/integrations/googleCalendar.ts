import { google, calendar_v3 } from 'googleapis';
import config from '../utils/config';
import logger from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  calendarOwner: 'user1' | 'user2';
}

type UserKey = 'user1' | 'user2';

function getOAuth2Client(user: UserKey) {
  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/callback'
  );

  const refreshToken = user === 'user1'
    ? config.GOOGLE_REFRESH_TOKEN_USER1
    : config.GOOGLE_REFRESH_TOKEN_USER2;

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function getCalendarId(user: UserKey): string {
  return user === 'user1'
    ? config.GOOGLE_CALENDAR_ID_USER1
    : config.GOOGLE_CALENDAR_ID_USER2;
}

function parseEvent(item: calendar_v3.Schema$Event, owner: UserKey): CalendarEvent {
  const isAllDay = !item.start?.dateTime;
  return {
    id: item.id || '',
    title: item.summary || '(No title)',
    start: new Date(item.start?.dateTime || item.start?.date || ''),
    end: new Date(item.end?.dateTime || item.end?.date || ''),
    isAllDay,
    calendarOwner: owner,
  };
}

export async function getUpcomingEvents(user: UserKey, daysAhead = 1): Promise<CalendarEvent[]> {
  const auth = getOAuth2Client(user);
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(user);

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map((item) => parseEvent(item, user));
  } catch (err) {
    logger.error(`Google Calendar getUpcomingEvents error (${user}): ${(err as Error).message}`);
    throw err;
  }
}

export async function createEvent(
  user: UserKey,
  event: Omit<CalendarEvent, 'id' | 'calendarOwner'>
): Promise<CalendarEvent> {
  const auth = getOAuth2Client(user);
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = getCalendarId(user);

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
    const response = await calendar.events.insert({ calendarId, requestBody });
    logger.info(`Created calendar event: ${event.title} (${user})`);
    return {
      id: response.data.id || '',
      title: event.title,
      start: event.start,
      end: event.end,
      isAllDay: event.isAllDay,
      calendarOwner: user,
    };
  } catch (err) {
    logger.error(`Google Calendar createEvent error (${user}): ${(err as Error).message}`);
    throw err;
  }
}

export async function getMergedEvents(daysAhead = 1): Promise<CalendarEvent[]> {
  const [user1Events, user2Events] = await Promise.all([
    getUpcomingEvents('user1', daysAhead).catch((err) => {
      logger.error(`Failed to fetch user1 calendar: ${(err as Error).message}`);
      return [] as CalendarEvent[];
    }),
    getUpcomingEvents('user2', daysAhead).catch((err) => {
      logger.error(`Failed to fetch user2 calendar: ${(err as Error).message}`);
      return [] as CalendarEvent[];
    }),
  ]);

  const all = [...user1Events, ...user2Events];

  // Deduplicate by title + start time
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    const key = `${e.title}|${e.start.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by start time
  deduped.sort((a, b) => a.start.getTime() - b.start.getTime());

  return deduped;
}
