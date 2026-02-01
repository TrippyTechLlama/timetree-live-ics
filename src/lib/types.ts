export type BasicAuth = {
  type: 'basic';
  username: string;
  password: string;
};

export type ExportJob = {
  id: string;
  email: string;
  password: string;
  calendarCode?: string;
  outputPath: string;
  birthdaysOutput?: string;
  memosOutput?: string;
  includeBirthdays?: boolean;
  includeMemos?: boolean;
  token?: string;
  auth?: BasicAuth;
};

export type JobState = {
  lastRun?: Date;
  lastSuccess?: Date;
  lastError?: string;
  running: boolean;
};

export type RunState = {
  lastRun?: Date;
  lastSuccess?: Date;
  lastError?: string;
  running: boolean;
  jobs: Record<string, JobState>;
};

export type BuildInfo = {
  version: string;
  commit?: string;
  buildTime?: string;
};

export type HealthPayload = {
  status: 'ok' | 'degraded';
  lastRun: string | null;
  lastSuccess: string | null;
  lastError: string | null;
  running: boolean;
  schedule: string;
  version: string;
  // Sensitive details are logged, not returned.
};

export type TimeTreeCalendarMetadata = {
  id: number;
  name: string;
  alias_code: string;
  deactivated_at: string | null;
};

export type TimeTreeEvent = {
  uuid: string;
  title: string;
  created_at: number;
  updated_at: number;
  recurrences: string[] | null;
  alerts: number[] | null;
  url: string;
  note: string;
  start_at: number;
  end_at: number;
  all_day: boolean;
  start_timezone: string;
  end_timezone: string;
  location_lat: string | null;
  location_lon: string | null;
  location: string;
  parent_id: string | null;
  type: number;
  category: number;
};
