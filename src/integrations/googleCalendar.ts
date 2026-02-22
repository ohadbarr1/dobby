import { google } from 'googleapis';
import config from '../utils/config';
import logger from '../utils/logger';

function getAuthClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
}

export async function getEvents(
  calendarId: string,
  refreshToken: string,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  const auth = getAuthClient(refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map((event) => ({
      title: event.summary || '(No title)',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
    }));
  } catch (err) {
    logger.error(`Google Calendar getEvents error: ${(err as Error).message}`);
    throw err;
  }
}

export async function addEvent(
  calendarId: string,
  refreshToken: string,
  title: string,
  startDatetime: string,
  endDatetime: string
): Promise<void> {
  const auth = getAuthClient(refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        start: { dateTime: startDatetime },
        end: { dateTime: endDatetime },
      },
    });
    logger.info(`Added calendar event: ${title}`);
  } catch (err) {
    logger.error(`Google Calendar addEvent error: ${(err as Error).message}`);
    throw err;
  }
}
