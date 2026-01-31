import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { TimeTreeCalendarMetadata, TimeTreeEvent } from '@/lib/types';

const API_BASE_URI = 'https://timetreeapp.com/api/v1';
const API_USER_AGENT = 'web/2.1.0/en';
const DEFAULT_TIMEOUT_MS = 10_000;

type FetchOptions = Omit<RequestInit, 'signal'> & { timeoutMs?: number };

function withTimeout(options: FetchOptions = {}): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<{ data: T | undefined; response: Response }> {
  const { timeoutMs, ...rest } = options;
  const { signal, clear } = withTimeout({ timeoutMs });
  try {
    const response = await fetch(url, { ...rest, signal });
    let data: T | undefined;
    try {
      data = (await response.json()) as T;
    } catch {
      data = undefined;
    }
    return { data, response };
  } finally {
    clear();
  }
}

function buildHeaders(sessionId?: string): HeadersInit {
  const base: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Timetreea': API_USER_AGENT,
  };
  if (sessionId) {
    return { ...base, Cookie: `_session_id=${sessionId}` };
  }
  return base;
}

export async function login(email: string, password: string): Promise<string> {
  const payload = {
    uid: email,
    password,
    uuid: randomUUID().replace(/-/g, ''),
  };

  const { response, data } = await fetchJson<Record<string, unknown>>(
    `${API_BASE_URI}/auth/email/signin`,
    {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
    throw new Error(`Login failed (${response.status}): ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/_session_id=([^;,\s]+)/);

  if (!sessionMatch || !sessionMatch[1]) {
    throw new Error('Login succeeded but session cookie was not returned');
  }

  return sessionMatch[1];
}

export async function fetchCalendars(sessionId: string): Promise<TimeTreeCalendarMetadata[]> {
  const { data, response } = await fetchJson<{ calendars: TimeTreeCalendarMetadata[] }>(
    `${API_BASE_URI}/calendars?since=0`,
    {
      method: 'GET',
      headers: buildHeaders(sessionId),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendars (${response.status})`);
  }

  const calendars = data?.calendars ?? [];
  const active = calendars.filter((c) => c.deactivated_at === null);

  if (active.length === 0) {
    throw new Error('No active calendars found for this account');
  }

  return active;
}

async function fetchEventsChunk(
  sessionId: string,
  calendarId: number,
  since?: number
): Promise<TimeTreeEvent[]> {
  const url = since
    ? `${API_BASE_URI}/calendar/${calendarId}/events/sync?since=${since}`
    : `${API_BASE_URI}/calendar/${calendarId}/events/sync`;

  const { data, response } = await fetchJson<{
    events: TimeTreeEvent[];
    chunk?: boolean;
    since?: number;
  }>(url, {
    method: 'GET',
    headers: buildHeaders(sessionId),
  });

  if (!response.ok) {
    const text =
      data === undefined ? 'unknown error' : typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Failed to fetch events (calendar ${calendarId}): ${response.status} ${text}`);
  }

  const events = data?.events ?? [];

  if (data?.chunk === true && typeof data.since === 'number') {
    const more = await fetchEventsChunk(sessionId, calendarId, data.since);
    return events.concat(more);
  }

  return events;
}

export async function fetchEvents(
  sessionId: string,
  calendarId: number,
  calendarName?: string
): Promise<TimeTreeEvent[]> {
  try {
    return await fetchEventsChunk(sessionId, calendarId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (calendarName) {
      logger.error({ calendarName }, `Failed to fetch events: ${message}`);
    } else {
      logger.error(`Failed to fetch events: ${message}`);
    }
    throw err;
  }
}

export async function resolveCalendar(
  sessionId: string,
  desiredAlias?: string
): Promise<{ calendarId: number; calendarName: string; aliasCode: string }> {
  const calendars = await fetchCalendars(sessionId);

  if (desiredAlias) {
    const match = calendars.find((c) => c.alias_code === desiredAlias);
    if (match) {
      return { calendarId: match.id, calendarName: match.name, aliasCode: match.alias_code };
    }
    logger.warn(`Calendar code "${desiredAlias}" not found; defaulting to first active calendar`);
  }

  const first = calendars[0];
  return { calendarId: first.id, calendarName: first.name, aliasCode: first.alias_code };
}
