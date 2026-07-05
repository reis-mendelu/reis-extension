import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { chromeStorageAdapter } from './chromeStorageAdapter';

/**
 * Supabase client that HOLDS the society/admin auth session. Kept separate from
 * the anon `supabase` client (reads/telemetry) so student reads never carry an
 * admin JWT. Session persists in chrome.storage.local — never localStorage.
 */
export const adminAuthClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: 'reis_admin_auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
