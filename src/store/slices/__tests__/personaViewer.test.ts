import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { fetchImpersonation } = vi.hoisted(() => ({ fetchImpersonation: vi.fn() }));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => fetchImpersonation(...a),
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import { useViewer, viewerOf } from '../../../hooks/useViewer';
import { matchesAudience } from '../../../utils/partnerAudience';
import { visibleToStudent } from '../../../utils/eventAudience';
import { buildFeed } from '../../../utils/novinky/buildFeed';
import type { Society } from '../../../types/events';
import type { SpolekNotification } from '../../../services/spolky/types';
import { PERSONA_REQ, PERSONA_RESULT } from './impersonationFixtures';

const partner = (id: string, audience: string[]): Society =>
  ({ id, name: id, kind: 'partner', audience, facultyKey: 'pef' }) as unknown as Society;
const SOCIETIES = {
  bank: partner('bank', ['pef:B-F']),
  software: partner('software', ['pef:B-OI']),
};
const row = (associationId: string): SpolekNotification => ({
  id: associationId,
  associationId,
  title: associationId,
  body: '',
  createdAt: '2026-09-25T10:00:00Z',
  expiresAt: '2026-09-30T10:00:00Z',
  startsAt: '2026-09-27',
  priority: 'normal',
});

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(2026, 8, 26), toFake: ['Date'] });
  await IndexedDBService.clearAll();
  // The admin: a PEF B-OI student.
  useAppStore.setState(
    overlayWrite({
      impersonation: null,
      adminRole: 'reis_admin' as const,
      demoMode: false,
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
      isErasmus: false,
    })
  );
  fetchImpersonation.mockReset();
  fetchImpersonation.mockResolvedValue(PERSONA_RESULT);
  await useAppStore.getState().startImpersonation(PERSONA_REQ);
});

describe('a PEF B-F persona is seen as a PEF B-F student', () => {
  it('matches a pef:B-F partner and not pef:B-OI', () => {
    const { result } = renderHook(() => useViewer());
    expect(result.current).toEqual(viewerOf(useAppStore.getState()));
    expect(matchesAudience(['pef:B-F'], result.current)).toBe(true);
    expect(matchesAudience(['pef:B-OI'], result.current)).toBe(false);
  });

  it('Novinky shows the B-F partner row, not the B-OI one', () => {
    const feed = buildFeed({
      allNotifications: [row('bank'), row('software')],
      societies: SOCIETIES,
      viewer: viewerOf(useAppStore.getState()),
      todayIso: '2026-09-26',
      nowMinute: '2026-09-26T10:00',
      isNotices: { cz: [], en: [] },
      isNoticeMutes: [],
      language: 'cz',
    });
    expect(feed.map((n) => n.id)).toEqual(['bank']);
  });

  it('the map shows the B-F partner event, not the B-OI one', () => {
    const { result } = renderHook(() => useViewer());
    const events = [{ societyId: 'bank' }, { societyId: 'software' }];
    expect(visibleToStudent(events, SOCIETIES, result.current)).toEqual([{ societyId: 'bank' }]);
  });
});

// Demo mode is entered signed out, after the restart that drops a persona, and
// a persona cannot start in demo mode. Should both ever meet anyway, the demo's
// own identity wins: the guard must not keep a persona over the sample student.
describe('demo mode and a persona', () => {
  it('entering the demo ends the persona and shows the demo identity', async () => {
    await useAppStore.getState().enterDemo();
    const s = useAppStore.getState();
    expect(s.impersonation).toBeNull();
    expect(s.userProgramme).toBeNull();
  });

  it('a persona cannot start in demo mode', async () => {
    useAppStore.setState(
      overlayWrite({ impersonation: null, userProgramme: 'B-OI', demoMode: true })
    );
    expect(await useAppStore.getState().startImpersonation(PERSONA_REQ)).toBe(false);
    expect(useAppStore.getState().userProgramme).toBe('B-OI');
    useAppStore.setState({ demoMode: false });
  });
});
