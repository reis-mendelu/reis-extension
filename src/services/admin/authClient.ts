import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { chromeStorageAdapter } from './chromeStorageAdapter';

/**
 * Where supabase-js keeps the society/admin session inside
 * chrome.storage.local. Exported because signing out has to be able to remove
 * it directly — see clearAdminSession.
 */
export const ADMIN_AUTH_STORAGE_KEY = 'reis_admin_auth';

/**
 * Supabase client that HOLDS the society/admin auth session. Kept separate from
 * the anon `supabase` client (reads/telemetry) so student reads never carry an
 * admin JWT. Session persists in chrome.storage.local — never localStorage.
 */
export const adminAuthClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: ADMIN_AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
