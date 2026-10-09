/** What reIS writes to the student's Google "Rozvrh" calendar. See the spec. */
export type ReisKind = 'lesson' | 'exam' | 'custom';
export type AppLanguage = 'cz' | 'en';

export interface NormalizedEvent {
  kind: ReisKind;
  key: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location: string;
  description: string;
}

export interface GoogleEventBody {
  id: string;
  summary: string;
  location: string;
  description: string;
  start: { dateTime: string; timeZone: 'Europe/Prague' };
  end: { dateTime: string; timeZone: 'Europe/Prague' };
  reminders: { useDefault: boolean; overrides?: [] };
  colorId?: string;
  status?: 'confirmed';
  extendedProperties: { private: { reisKind: ReisKind; reisHash: string; reisV: '1' } };
}

export interface DesiredEvent {
  id: string;
  kind: ReisKind;
  date: string;
  hash: string;
  body: GoogleEventBody;
}

export interface ExistingEvent {
  id: string;
  kind: ReisKind;
  date: string; // YYYY-MM-DD of start
  hash: string;
}
