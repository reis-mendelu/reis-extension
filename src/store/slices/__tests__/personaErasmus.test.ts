import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  fetchImpersonation: vi.fn(),
  loadOptions: vi.fn(),
  loadYear1Groups: vi.fn(),
}));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => m.fetchImpersonation(...a),
}));
vi.mock('../../../api/impersonation/options', () => ({
  loadOptions: (...a: unknown[]) => m.loadOptions(...a),
  loadYear1Groups: (...a: unknown[]) => m.loadYear1Groups(...a),
}));
vi.mock('../../../services/admin/hasAdminSession', () => ({ hasAdminSession: async () => false }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));
vi.mock('../../../utils/userParams', async (orig) => ({
  ...(await orig<typeof import('../../../utils/userParams')>()),
  getUserParams: async () => null,
  isIdentityConfirmed: () => true,
}));

import { useAppStore } from '../../useAppStore';
import { IndexedDBService } from '../../../services/storage';
import { viewerOf } from '../../../hooks/useViewer';
import { canSee } from '../../../utils/eventAudience';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import type { Society } from '../../../types/events';
import * as setup from './personaSliceSetup';

const { s, codes } = setup;
const { fetchImpersonation, loadOptions } = m;

/** The Erasmus persona: identity and cache (design 2026-11-27 §2, §4; step C). */
beforeEach(async () => {
  await setup.resetPersonaStore(m);
  // The admin studies in Czech, chosen and saved like any student's choice.
  await IndexedDBService.set('meta', 'reis_language', 'cz');
  useAppStore.setState({ language: 'cz', personaLanguage: null });
  await s().loadLanguage();
});
afterEach(() => vi.restoreAllMocks());

describe('Erasmus persona: identity', () => {
  it('is PEF / Z-EXC / isErasmus, fetched with its pinned courses and no group', async () => {
    expect(await s().switchToPersona('erasmus')).toBe(true);
    expect(fetchImpersonation.mock.calls[0]![0]).toMatchObject({
      erasmus: true,
      group: null,
      courses: [
        { code: 'EBA-MAR', predmetId: '1' },
        { code: 'EBA-MI', predmetId: '2' },
        { code: 'EBA-MT', predmetId: '3' },
        { code: 'EBA-PE', predmetId: '4' },
        { code: 'EBA-FT', predmetId: '5' },
      ],
    });
    expect(m.loadYear1Groups).not.toHaveBeenCalled();
    expect(s()).toMatchObject({ userFaculty: 'PEF', userProgramme: 'Z-EXC', isErasmus: true });
  });

  it('sees ESN and reIS rows only, not a partner aimed at pef:B-OI', async () => {
    await s().switchToPersona('erasmus');
    const viewer = viewerOf(s());
    expect(viewer.exchange).toBe(true);
    const partner: Society = {
      ...BUNDLED_SOCIETIES.supef!,
      id: 'partner',
      kind: 'partner',
      audience: ['pef:B-OI'],
    };
    const cat = { ...BUNDLED_SOCIETIES, partner };
    const ev = (societyId: string, subscribersOnly = false) => ({ societyId, subscribersOnly });
    expect(canSee(ev('esn', true), cat, viewer)).toBe(true);
    expect(canSee(ev('reis'), cat, viewer)).toBe(true);
    expect(canSee(ev('supef'), cat, viewer)).toBe(false);
    expect(canSee(ev('partner'), cat, viewer)).toBe(false);
    // The IT persona is shown that partner: the difference is the persona.
    await s().switchToPersona('it');
    expect(canSee(ev('partner'), cat, viewerOf(s()))).toBe(true);
  });

  it('a cached Erasmus switch applies without a fetch', async () => {
    await s().switchToPersona('erasmus');
    await s().switchToPersona('it');
    fetchImpersonation.mockClear();
    loadOptions.mockClear();
    expect(await s().switchToPersona('erasmus')).toBe(true);
    expect(codes()).toEqual(['Z-EXC-1']);
    expect(fetchImpersonation).not.toHaveBeenCalled();
    expect(loadOptions).not.toHaveBeenCalled();
  });
});
