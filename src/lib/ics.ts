import { DateTime } from 'luxon';
import { TimeTreeEvent } from '@/lib/types';
import { logger } from '@/lib/logger';

const RFC5545_MAX_LINE = 75;

const EVENT_TYPE_BIRTHDAY = 1;
const EVENT_CATEGORY_MEMO = 2;

function escapeText(input?: string | null): string | undefined {
  if (!input) return undefined;
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line: string): string {
  if (line.length <= RFC5545_MAX_LINE) return line;
  let remaining = line;
  const parts: string[] = [];
  while (remaining.length > RFC5545_MAX_LINE) {
    parts.push(remaining.slice(0, RFC5545_MAX_LINE));
    remaining = remaining.slice(RFC5545_MAX_LINE);
  }
  parts.push(remaining);
  return parts.join('\r\n ');
}

function formatDate(ms: number, tz: string): string {
  return DateTime.fromMillis(ms, { zone: tz }).toFormat('yyyyLLdd');
}

function formatDateTimeUTC(ms: number, tz: string): string {
  return DateTime.fromMillis(ms, { zone: tz })
    .toUTC()
    .toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function addIfPresent(lines: string[], label: string, value?: string | null) {
  if (value === undefined || value === null || value === '') return;
  lines.push(`${label}:${value}`);
}

function buildEventLines(
  event: TimeTreeEvent,
  opts: { includeBirthdays?: boolean; includeMemos?: boolean }
): string[] | null {
  if (event.type === EVENT_TYPE_BIRTHDAY && !opts.includeBirthdays) {
    logger.debug({ uid: event.uuid, title: event.title }, 'Skipping birthday event while building ICS');
    return null;
  }
  if (event.category === EVENT_CATEGORY_MEMO && !opts.includeMemos) {
    logger.debug({ uid: event.uuid, title: event.title }, 'Skipping memo event while building ICS');
    return null;
  }

  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  addIfPresent(lines, 'UID', event.uuid);
  addIfPresent(lines, 'SUMMARY', escapeText(event.title));

  const dtStamp = DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'");
  addIfPresent(lines, 'DTSTAMP', dtStamp);
  addIfPresent(lines, 'CREATED', formatDateTimeUTC(event.created_at, 'UTC'));
  addIfPresent(lines, 'LAST-MODIFIED', formatDateTimeUTC(event.updated_at, 'UTC'));

  if (event.all_day) {
    const start = formatDate(event.start_at, event.start_timezone ?? 'UTC');
    const end = formatDate(event.end_at, event.end_timezone ?? event.start_timezone ?? 'UTC');
    addIfPresent(lines, 'DTSTART;VALUE=DATE', start);
    addIfPresent(lines, 'DTEND;VALUE=DATE', end);
  } else {
    const startZone = event.start_timezone ?? 'UTC';
    const endZone = event.end_timezone ?? event.start_timezone ?? 'UTC';
    const start = DateTime.fromMillis(event.start_at, { zone: startZone });
    const end = DateTime.fromMillis(event.end_at, { zone: endZone });

    if (startZone && startZone !== 'UTC') {
      addIfPresent(lines, `DTSTART;TZID=${startZone}`, start.toFormat("yyyyLLdd'T'HHmmss"));
    } else {
      addIfPresent(lines, 'DTSTART', start.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'"));
    }

    if (endZone && endZone !== 'UTC') {
      addIfPresent(lines, `DTEND;TZID=${endZone}`, end.toFormat("yyyyLLdd'T'HHmmss"));
    } else {
      addIfPresent(lines, 'DTEND', end.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'"));
    }
  }

  addIfPresent(lines, 'LOCATION', escapeText(event.location));
  if (event.location_lat !== null && event.location_lon !== null) {
    addIfPresent(lines, 'GEO', `${event.location_lat};${event.location_lon}`);
  }
  addIfPresent(lines, 'URL', escapeText(event.url));
  addIfPresent(lines, 'DESCRIPTION', escapeText(event.note));
  addIfPresent(lines, 'RELATED-TO', escapeText(event.parent_id ?? undefined));

  if (Array.isArray(event.recurrences)) {
    for (const recurrence of event.recurrences) {
      if (typeof recurrence === 'string' && recurrence.trim().length > 0) {
        lines.push(recurrence.trim());
      }
    }
  }

  if (Array.isArray(event.alerts)) {
    for (const alertMinutes of event.alerts) {
      if (typeof alertMinutes !== 'number') continue;
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Reminder');
      lines.push(`TRIGGER:-PT${Math.max(0, alertMinutes)}M`);
      lines.push('END:VALARM');
    }
  }

  lines.push('END:VEVENT');
  return lines;
}

export function buildICS(
  events: TimeTreeEvent[],
  prodVersion = 'timetree-live-ics',
  opts: { includeBirthdays?: boolean; includeMemos?: boolean } = {}
): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push(`PRODID:-//TimeTree Exporter ${prodVersion}//EN`);
  lines.push('VERSION:2.0');

  for (const event of events) {
    const eventLines = buildEventLines(event, opts);
    if (!eventLines) continue;
    lines.push(...eventLines);
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
