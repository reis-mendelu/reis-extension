import { registerPlugin } from '@capacitor/core';

export interface GoogleTokenResult {
  accessToken: string | null;
  grantedScopes: string[];
  /** iOS only: Android's Authorization API does not report an expiry. */
  expiresAtMs?: number;
  email?: string;
}

interface GoogleCalendarAuthNative {
  connect(o: { clientId?: string; scopes: string[] }): Promise<GoogleTokenResult>;
  getAccessToken(o: { clientId?: string; scopes: string[] }): Promise<GoogleTokenResult>;
  disconnect(): Promise<void>;
}

/** SPIKE. iOS half: native/capacitor-google-calendar. Android half: GoogleCalendarAuthPlugin.java. */
export const GoogleCalendarAuth = registerPlugin<GoogleCalendarAuthNative>('GoogleCalendarAuth');
