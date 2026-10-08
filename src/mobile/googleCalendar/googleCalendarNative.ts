import { registerPlugin } from '@capacitor/core';

/** One JS name, two native halves: GoogleCalendarPlugin.java and native/capacitor-google-calendar. */
export interface GoogleCalendarNativePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  connect(): Promise<{ email: string | null; scopes: string[] }>;
  accessToken(): Promise<{ token: string }>;
  invalidateToken(o: { token: string }): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<{ connected: boolean; email: string | null }>;
}

export const SCOPE_APP_CREATED = 'https://www.googleapis.com/auth/calendar.app.created';
export const SCOPE_CALENDAR_LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';

export const GoogleCalendarNative = registerPlugin<GoogleCalendarNativePlugin>('GoogleCalendar');
