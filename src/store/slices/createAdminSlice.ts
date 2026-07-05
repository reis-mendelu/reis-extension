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
  adminAssociationId: string | null;
  adminOverlayOpen: boolean;
  societyPosts: SpolkyEventRow[];
  openAdminOverlay: () => void;
  closeAdminOverlay: () => void;
  adminLogin: (email: string, password: string) => Promise<{ error?: string }>;
  adminLogout: () => Promise<void>;
  loadAdminSession: () => Promise<void>;
  loadSocietyPosts: () => Promise<void>;
}

async function resolveAccount(email: string): Promise<{ role: AdminRole | null; associationId: string | null }> {
  const { data, error } = await adminAuthClient
    .from('spolky_accounts')
    .select('role, association_id')
    .eq('email', email)
    .maybeSingle();
  if (error) logError('Admin.resolveAccount', error);
  return { role: (data?.role as AdminRole) ?? null, associationId: data?.association_id ?? null };
}

// The society/admin auth session. Separate from IS-Mendelu data; hydrated at
// startup from chrome.storage via loadAdminSession(). isAssociation/role gate the
// UI only — every write is RLS-gated server-side.
export const createAdminSlice: AppSlice<AdminSlice> = (set, get) => ({
  adminSession: null,
  adminRole: null,
  adminAssociationId: null,
  adminOverlayOpen: false,
  societyPosts: [],
  openAdminOverlay: () => { set({ adminOverlayOpen: true }); void get().loadSocietyPosts(); },
  closeAdminOverlay: () => set({ adminOverlayOpen: false }),
  adminLogin: async (emailInput, password) => {
    const email = normalizeEmail(emailInput);
    const { data, error } = await adminAuthClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: 'invalid_credentials' };
    const { role, associationId } = await resolveAccount(email);
    if (role === null) {
      try { await adminAuthClient.auth.signOut(); } catch (e) { logError('Admin.login.signOut', e); }
      return { error: 'account_unavailable' };
    }
    set({ adminSession: data.session, adminRole: role, adminAssociationId: associationId });
    await get().loadSocietyPosts();
    return {};
  },
  adminLogout: async () => {
    try { await adminAuthClient.auth.signOut(); } catch (e) { logError('Admin.logout', e); }
    set({
      adminSession: null, adminRole: null, adminAssociationId: null, adminOverlayOpen: false,
      societyPosts: [], societyMapEvents: [], mapMode: 'student',
    });
  },
  loadAdminSession: async () => {
    const { data } = await adminAuthClient.auth.getSession();
    if (!data.session) return;
    const email = data.session.user.email ?? '';
    const { role, associationId } = await resolveAccount(email);
    if (role === null) {
      try { await adminAuthClient.auth.signOut(); } catch (e) { logError('Admin.loadSession.signOut', e); }
      return;
    }
    set({ adminSession: data.session, adminRole: role, adminAssociationId: associationId });
    await get().loadSocietyPosts();
  },
  loadSocietyPosts: async () => {
    const associationId = get().adminAssociationId;
    if (!associationId) { set({ societyPosts: [] }); get().refreshSocietyMapEvents(); return; }
    const posts = await listMyPosts(associationId);
    set({ societyPosts: posts });
    get().refreshSocietyMapEvents();
  },
});
