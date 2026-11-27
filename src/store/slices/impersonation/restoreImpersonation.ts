import type { AppState } from '../../types';
import { currentPeriod, periodLabel } from '../../../api/impersonation/intake';
import { loadImpersonation, clearImpersonation } from './impersonationStorage';
import { clearPersonaCache, hasPersonaCache } from './personaCache';
import { applyImpersonation, currentImpersonationEpoch } from './applyImpersonation';
import { hasAdminSession } from '../../../services/admin/hasAdminSession';

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

/**
 * A boot with no admin session ends the cached personas too, even with none
 * active: they belong to the admin session (design 2026-11-27 §3). The admin
 * session is looked up only when a persona is cached, so a student's boot asks
 * nothing.
 */
async function dropPersonasWithoutAdmin(role: string | null): Promise<void> {
  if (role === 'reis_admin' || !(await hasPersonaCache().catch(() => false))) return;
  if (role !== null || !(await hasAdminSession())) await clearPersonaCache().catch(() => {});
}

/**
 * Boot, after loadAdminSession settles. Admin logout, IS logout and a changed
 * student all leave NO admin session behind — that, or a non-admin role,
 * clears it. A session whose role lookup failed (offline) keeps it for the
 * next boot without applying it.
 */
export async function restoreImpersonation(set: Set, get: Get): Promise<void> {
  // Anything the admin does while this reads IndexedDB (Já, a persona) wins.
  const epoch = currentImpersonationEpoch();
  const saved = await loadImpersonation().catch(() => null);
  if (!saved) return dropPersonasWithoutAdmin(get().adminRole);
  const drop = async (why?: 'expired') => {
    await clearImpersonation().catch(() => {});
    if (why) set({ impersonationError: why });
    // No admin session (or not a reis_admin): the persona cache goes too.
    else await clearPersonaCache().catch(() => {});
  };
  if (saved.selection.periodLabel !== periodLabel(currentPeriod(new Date()))) {
    await drop('expired');
    return dropPersonasWithoutAdmin(get().adminRole);
  }
  const role = get().adminRole;
  if (role === 'reis_admin') {
    await applyImpersonation(set, get, saved, { epoch }).catch(() => {});
    return;
  }
  if (role !== null || !(await hasAdminSession())) return drop();
}
