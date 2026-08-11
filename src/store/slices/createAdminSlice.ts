import type { Session } from '@supabase/supabase-js';
import type { AppSlice } from '../types';
import { adminAuthClient } from '../../services/admin/authClient';
import { normalizeEmail } from '../../services/admin/societyLogin';
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
  /** reIS admin only: author as a different society. */
  setActiveAssociation: (id: string) => void;
  adminLogin: (email: string, password: string) => Promise<{ error?: string }>;
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
  closeSocietyAdmin: () => {
    // Leave no half-finished authoring behind: an open composer or an armed
    // "click to place" would otherwise still be live on the student map.
    get().closeComposer();
    get().clearMapSelection();
    set({ adminConsoleOpen: false });
  },
  setActiveAssociation: (id) => {
    set({ adminActiveAssociationId: id });
    void get().loadSocietyPosts();
  },
  adminLogin: async (emailInput, password) => {
    const email = normalizeEmail(emailInput);
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
    await get().loadSocietyPosts();
    return {};
  },
  adminLogout: async () => {
    try {
      await adminAuthClient.auth.signOut();
    } catch (e) {
      logError('Admin.logout', e);
    }
    set({
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: false,
      societyPosts: [],
      societyMapEvents: [],
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
    set({ societyPosts: posts });
    get().refreshSocietyMapEvents();
  },
});
