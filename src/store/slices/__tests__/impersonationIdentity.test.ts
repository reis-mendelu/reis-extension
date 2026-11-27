import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchImpersonation, hasAdminSession, getUserParams } = vi.hoisted(() => ({
  fetchImpersonation: vi.fn(),
  hasAdminSession: vi.fn(async () => false),
  getUserParams: vi.fn(),
}));
vi.mock('../../../services/admin/hasAdminSession', () => ({
  hasAdminSession: () => hasAdminSession(),
}));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
}));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));
vi.mock('../../../utils/userParams', async (orig) => ({
  ...(await orig<typeof import('../../../utils/userParams')>()),
  getUserParams,
  isIdentityConfirmed: () => true,
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { identityOverlay } from '../../overlay/identityOverlay';
import { IndexedDBService } from '../../../services/storage';
import { PERSONA_REQ, PERSONA_RESULT } from './impersonationFixtures';

/**
 * Design 2026-11-27 §2: a persona is the whole student. The admin here is a
 * PEF B-OI student (with an Erasmus flag, so its return is visible); the
 * persona is PEF B-F. The same faculty on purpose: that is where the admin's
 * own programme could be mistaken for the persona's.
 */
const REAL = { facultyLabel: 'PEF', studyProgram: 'B-OI-ZBOI', isErasmus: true };
const OWN = { userFaculty: 'PEF', userProgramme: 'B-OI', isErasmus: true };
const PERSONA = { userFaculty: 'PEF', userProgramme: 'B-F', isErasmus: false };

const identity = () => {
  const s = useAppStore.getState();
  return { userFaculty: s.userFaculty, userProgramme: s.userProgramme, isErasmus: s.isErasmus };
};
const remembered = () => IndexedDBService.get('meta', 'viewer_audience');

/** A relaunch: memory is empty, IndexedDB is not. */
const restart = (adminRole: 'reis_admin' | null) =>
  useAppStore.setState(
    overlayWrite({
      impersonation: null,
      adminRole,
      userFaculty: null,
      userProgramme: null,
      isErasmus: false,
    })
  );

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  restart('reis_admin');
  useAppStore.setState({ demoMode: false, impersonationError: null });
  fetchImpersonation.mockReset();
  fetchImpersonation.mockResolvedValue(PERSONA_RESULT);
  hasAdminSession.mockResolvedValue(false);
  getUserParams.mockReset();
  getUserParams.mockResolvedValue(REAL);
  await useAppStore.getState().loadContext();
  expect(identity()).toEqual(OWN);
});

describe('persona identity', () => {
  it('start puts the persona in the store; the real loadContext reaches IndexedDB only', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    expect(identity()).toEqual(PERSONA);

    getUserParams.mockResolvedValue({
      facultyLabel: 'FRRMS',
      studyProgram: 'B-METS-X',
      isErasmus: false,
    });
    await useAppStore.getState().loadContext();
    expect(identity()).toEqual(PERSONA);
    expect(await remembered()).toMatchObject({
      faculty: 'FRRMS',
      programme: 'B-METS',
      erasmus: false,
    });
  });

  // loadContext keeps a known programme when IS names none for the same
  // faculty. With a persona in memory, "known" must be the student's own.
  it('IS naming no programme keeps the real one remembered, not the persona', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    getUserParams.mockResolvedValue({ facultyLabel: 'PEF', isErasmus: true });
    await useAppStore.getState().loadContext();
    expect(await remembered()).toMatchObject({ programme: 'B-OI' });
    await useAppStore.getState().stopImpersonation();
    expect(identity()).toEqual(OWN);
  });

  it('carries an Erasmus identity when the selection says so (the picker never does)', () => {
    expect(identityOverlay({ faculty: 'PEF', shortCode: 'B-F' })).toEqual(PERSONA);
    expect(identityOverlay({ faculty: 'PEF', shortCode: 'Z-EXC-X', erasmus: true })).toEqual({
      userFaculty: 'PEF',
      userProgramme: 'Z-EXC',
      isErasmus: true,
    });
  });
});

describe('every exit brings the real identity back', () => {
  it('the banner (stopImpersonation)', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    await useAppStore.getState().stopImpersonation();
    expect(identity()).toEqual(OWN);
  });

  it('admin logout', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    await useAppStore.getState().adminLogout();
    expect(identity()).toEqual(OWN);
  });

  // IS logout restarts the app (mobile/signOut.ts) with no admin session left;
  // the boot's loadContext may run before restore drops the saved persona...
  it('IS logout: the restart drops the persona, the real identity loads', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    restart(null);
    await useAppStore.getState().loadContext();
    await useAppStore.getState().restoreImpersonation();
    expect(useAppStore.getState().impersonation).toBeNull();
    expect(identity()).toEqual(OWN);
  });

  // ...or after it: a changed student restarts through watchSignedInStudent,
  // which has dropped the admin login first.
  it('identity change: the restart drops the persona, the real identity loads', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    restart(null);
    await useAppStore.getState().restoreImpersonation();
    await useAppStore.getState().loadContext();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
    expect(identity()).toEqual(OWN);
  });

  it('expired: a persona from another period never comes back', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    restart('reis_admin');
    vi.setSystemTime(new Date(2027, 2, 1));
    await useAppStore.getState().restoreImpersonation();
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().impersonationError).toBe('expired');
    expect(identity()).toEqual(OWN);
  });

  it('a relaunch with the persona still valid puts the persona back, not the admin', async () => {
    await useAppStore.getState().startImpersonation(PERSONA_REQ);
    restart('reis_admin');
    await useAppStore.getState().loadContext();
    await useAppStore.getState().restoreImpersonation();
    await useAppStore.getState().loadContext();
    expect(identity()).toEqual(PERSONA);
  });
});
