import type { Session } from '@supabase/supabase-js';
import type { AppSlice } from '../types';
import { adminAuthClient } from '../../services/admin/authClient';
import { toAuthEmail } from '../../services/admin/societyLogin';
import { listMyPosts, type SpolkyEventRow } from '../../api/societyPosts';
import { logError } from '../../utils/reportError';

export type AdminRole = 'association' | 'reis_admin';

export interface AdminSlice {
  adminSession: Session | null;
  adminRole: AdminRole | null;
  /** The society this account *belongs to*. Null for a reIS admin, who belongs to none. */
  adminAssociationId: string | null;
  /** The society currently being authored. Pinned to the account's own for an
   *  association; chosen from the picker for a reIS admin, who may edit any. */
  adminActiveAssociationId: string | null;
  /** True while the admin console has taken the whole app over. */
  adminConsoleOpen: boolean;
  societyPosts: SpolkyEventRow[];
  /** Open the console. Unconditional — it renders its own login screen when logged out. */
  openSocietyAdmin: () => void;
  /** Leave the console for the student app. Keeps the session; only logout drops it. */
  closeSocietyAdmin: () => void;
  /** Clear in-progress authoring (composer, draft pin, map selection). */
  resetAuthoringState: () => void;
  /** reIS admin only: author as a different society. */
  setActiveAssociation: (id: string) => void;
  /** `username` is a society name ("supef") or, for the break-glass admin, a full address. */
  adminLogin: (username: string, password: string) => Promise<{ error?: string }>;
  adminLogout: () => Promise<void>;
  loadAdminSession: () => Promise<void>;
  loadSocietyPosts: () => Promise<void>;
}

async function resolveAccount(
  email: string
): Promise<{ role: AdminRole | null; associationId: string | null }> {
  const { data, error } = await adminAuthClient
    .from('spolky_accounts')
    .select('role, association_id')
    .eq('email', email)
    .maybeSingle();
  if (error) logError('Admin.resolveAccount', error);
  return { role: (data?.role as AdminRole) ?? null, associationId: data?.association_id ?? null };
}

// The society/admin auth session. Separate from IS-Mendelu data; hydrated at
// startup from chrome.storage via loadAdminSession(). role/association gate the
// UI only — every write is RLS-gated server-side, and the policies already let a
// reis_admin write for any association, which is what makes the picker possible
// without any backend change.
export const createAdminSlice: AppSlice<AdminSlice> = (set, get) => ({
  adminSession: null,
  adminRole: null,
  adminAssociationId: null,
  adminActiveAssociationId: null,
  adminConsoleOpen: false,
  societyPosts: [],
  openSocietyAdmin: () => set({ adminConsoleOpen: true }),
  /**
   * Drop every trace of in-progress authoring. Called at each boundary where
   * the thing being authored stops being the thing on screen — leaving the
   * console, switching society, logging out.
   *
   * One path rather than three copies, because the copies drifted: logout used
   * to skip this, so signing out mid-placement dropped you into the STUDENT map
   * with "click to place" still armed. Switching society was worse — editEventId
   * survived and pointed at the previous society's event, so saving wrote to a
   * society the header no longer named.
   */
  resetAuthoringState: () => {
    get().closeComposer();
    get().clearMapSelection();
  },
  closeSocietyAdmin: () => {
    get().resetAuthoringState();
    set({ adminConsoleOpen: false });
  },
  setActiveAssociation: (id) => {
    get().resetAuthoringState();
    set({ adminActiveAssociationId: id });
    void get().loadSocietyPosts();
  },
  adminLogin: async (usernameInput, password) => {
    let email: string;
    try {
      email = toAuthEmail(usernameInput);
    } catch {
      // A malformed username can never match an account. Fail like a wrong
      // password rather than surfacing a distinct error, which would let someone
      // probe which names are well-formed.
      return { error: 'invalid_credentials' };
    }
    const { data, error } = await adminAuthClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: 'invalid_credentials' };
    const { role, associationId } = await resolveAccount(email);
    if (role === null) {
      try {
        await adminAuthClient.auth.signOut();
      } catch (e) {
        logError('Admin.login.signOut', e);
      }
      return { error: 'account_unavailable' };
    }
    set({
      adminSession: data.session,
      adminRole: role,
      adminAssociationId: associationId,
      adminActiveAssociationId: associationId,
    });
    // Pull the inbox as soon as the role is known. This is a pull, not a push:
    // nothing arrives while the iframe is closed, so the count is refreshed at
    // every open and announced by SuggestionsToast.
    if (role === 'reis_admin') await get().loadSuggestions();
    await get().loadSocietyPosts();
    return {};
  },
  adminLogout: async () => {
    try {
      await adminAuthClient.auth.signOut();
    } catch (e) {
      logError('Admin.logout', e);
    }
    get().resetAuthoringState();
    set({
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: false,
      societyPosts: [],
      societyMapEvents: [],
      suggestions: [],
      suggestionsUnread: 0,
    });
  },
  loadAdminSession: async () => {
    const { data } = await adminAuthClient.auth.getSession();
    if (!data.session) return;
    const email = data.session.user.email ?? '';
    const { role, associationId } = await resolveAccount(email);
    if (role === null) {
      try {
        await adminAuthClient.auth.signOut();
      } catch (e) {
        logError('Admin.loadSession.signOut', e);
      }
      return;
    }
    // Deliberately does not open the console: a restored session lands in the
    // student app, and the "Spravovat spolky" button is the only way in.
    set({
      adminSession: data.session,
      adminRole: role,
      adminAssociationId: associationId,
      adminActiveAssociationId: associationId,
    });
    // Pull the inbox as soon as the role is known. This is a pull, not a push:
    // nothing arrives while the iframe is closed, so the count is refreshed at
    // every open and announced by SuggestionsToast.
    if (role === 'reis_admin') await get().loadSuggestions();
    await get().loadSocietyPosts();
  },
  loadSocietyPosts: async () => {
    const associationId = get().adminActiveAssociationId;
    if (!associationId) {
      set({ societyPosts: [] });
      get().refreshSocietyMapEvents();
      return;
    }
    const posts = await listMyPosts(associationId);
    // Two picker changes in quick succession can resolve out of order. Without
    // this guard the slower, older response wins and the console shows one
    // society's events under another's name — and delete/edit act on THOSE
    // rows, so the damage is to a society nobody is looking at.
    if (get().adminActiveAssociationId !== associationId) return;
    set({ societyPosts: posts });
    get().refreshSocietyMapEvents();
  },
});
