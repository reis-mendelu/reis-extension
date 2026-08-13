import { adminAuthClient } from '@/services/admin/authClient';
import { useAppStore } from '@/store/useAppStore';
import { ADMIN_SESSION_ROUTE } from './adminSessionRoute';

/**
 * Dev-harness side of the real-admin login. Asks the dev server for a session
 * (see adminSessionPlugin.ts — the sign-in happens there, so no password is
 * ever in this bundle) and installs it into the same client the app uses.
 *
 * Deliberately fire-and-forget rather than awaited: ES imports are synchronous,
 * so the app has already booted by the time this resolves. Calling
 * loadAdminSession() afterwards is what makes the store pick the session up,
 * which is why order does not matter here.
 *
 * A 204 means no credentials are configured — the normal case for plain
 * `npm run dev:web`. Stay quiet and leave the login screen alone.
 */
async function installDevAdminSession(): Promise<void> {
  // VITE_DEV_SOCIETY fakes a session AND routes every write to an in-memory
  // store, so a real session here would be silently pointless — you would
  // "publish" against live credentials and nothing would leave the browser.
  // Refuse to mix the two.
  if (import.meta.env.VITE_DEV_SOCIETY) return;

  const res = await fetch(ADMIN_SESSION_ROUTE);
  if (res.status === 204) return;
  if (!res.ok) {
    console.warn('[reis] dev admin session unavailable — the console will ask you to log in');
    return;
  }

  const { access_token, refresh_token } = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  const { error } = await adminAuthClient.auth.setSession({ access_token, refresh_token });
  if (error) {
    console.warn('[reis] dev admin session rejected by the client');
    return;
  }

  // Resolves role + association from spolky_accounts and loads the society's
  // posts — the same path a real login takes.
  await useAppStore.getState().loadAdminSession();
  console.log('[reis] signed in as the dev admin account — publishes hit real Supabase');
}

void installDevAdminSession().catch((e) => console.warn('[reis] dev admin session failed', e));
