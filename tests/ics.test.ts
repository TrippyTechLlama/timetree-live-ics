import { describe, it, expect } from 'vitest';
import { buildICS } from '@/lib/ics';
import { TimeTreeEvent } from '@/lib/types';

const baseEvent: TimeTreeEvent = {
  uuid: '1',
  title: 'Normal',
  created_at: Date.now(),
  updated_at: Date.now(),
  recurrences: null,
  alerts: null,
  url: '',
  note: '',
  start_at: Date.now(),
  end_at: Date.now() + 3_600_000,
  all_day: false,
  start_timezone: 'UTC',
  end_timezone: 'UTC',
  location_lat: null,
  location_lon: null,
  location: '',
  parent_id: null,
  type: 0,
  category: 0,
};

function clone(event: TimeTreeEvent, overrides: Partial<TimeTreeEvent>): TimeTreeEvent {
  return { ...event, ...overrides };
}

describe('buildICS filtering', () => {
  const events = [
    baseEvent,
    clone(baseEvent, { uuid: 'bday', title: 'Birthday', type: 1 }),
    clone(baseEvent, { uuid: 'memo', title: 'Memo', category: 2 }),
  ];

  it('excludes birthdays and memos by default', () => {
    const ics = buildICS(events, 'test');
    expect(ics).toContain('SUMMARY:Normal');
    expect(ics).not.toContain('SUMMARY:Birthday');
    expect(ics).not.toContain('SUMMARY:Memo');
  });

  it('includes birthdays when enabled', () => {
    const ics = buildICS(events, 'test', { includeBirthdays: true });
    expect(ics).toContain('SUMMARY:Birthday');
  });

  it('includes memos when enabled', () => {
    const ics = buildICS(events, 'test', { includeMemos: true });
    expect(ics).toContain('SUMMARY:Memo');
  });
});
