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
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import { syncService } from '../../../services/sync';
import { getCurrentLanguage } from '../../../i18n/currentLanguage';
import { viewerOf } from '../../../hooks/useViewer';
import { canSee } from '../../../utils/eventAudience';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import type { Society } from '../../../types/events';
import * as setup from './personaSliceSetup';

const { s, codes } = setup;
const { fetchImpersonation, loadOptions } = m;

/** The Erasmus persona (design 2026-11-27 §2 "Language", §4; step C). */
beforeEach(async () => {
  await setup.resetPersonaStore(m);
  // The admin studies in Czech, chosen and saved like any student's choice.
  await IndexedDBService.set('meta', 'reis_language', 'cz');
  useAppStore.setState({ language: 'cz', personaLanguage: null });
  await s().loadLanguage();
});
afterEach(() => vi.restoreAllMocks());

const savedLanguage = () => IndexedDBService.get('meta', 'reis_language');

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

describe('Erasmus persona: English in memory only', () => {
  it('entering sets en in memory and writes nothing to storage or other tabs', async () => {
    const set = vi.spyOn(IndexedDBService, 'set');
    const post = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
    const refresh = vi.spyOn(syncService, 'triggerRefresh');
    await s().switchToPersona('erasmus');
    expect(s().language).toBe('en');
    expect(getCurrentLanguage()).toBe('en');
    expect(set.mock.calls.filter(([, key]) => key === 'reis_language')).toEqual([]);
    expect(post).not.toHaveBeenCalled();
    expect(await savedLanguage()).toBe('cz');
    // The menu, files and map events follow the language, as on a real switch.
    expect(refresh).toHaveBeenCalledWith('LANGUAGE_UPDATE');
  });

  it('a reload of the language (another tab, a sync) keeps en while Erasmus is active', async () => {
    await s().switchToPersona('erasmus');
    await s().loadLanguage();
    expect(s().language).toBe('en');
  });

  it.each([
    ['Já', () => s().stopImpersonation()],
    ['another persona', () => s().switchToPersona('finance')],
    ['admin logout', () => s().adminLogout()],
  ])('%s restores the admin language', async (_, exit) => {
    await s().switchToPersona('erasmus');
    await exit();
    await vi.waitFor(() => expect(s().language).toBe('cz'));
    expect(getCurrentLanguage()).toBe('cz');
    expect(await savedLanguage()).toBe('cz');
  });

  it('IS logout reloads the app: nothing was saved, so the reload reads the admin language', async () => {
    await s().switchToPersona('erasmus');
    useAppStore.setState(overlayWrite({ impersonation: null, personaLanguage: null }));
    await s().loadLanguage();
    expect(s().language).toBe('cz');
  });

  it('boot restore of Erasmus re-applies en; of another persona keeps the admin language', async () => {
    await s().switchToPersona('erasmus');
    useAppStore.setState(overlayWrite({ impersonation: null, personaLanguage: null }));
    await s().loadLanguage();
    await s().restoreImpersonation();
    expect(s().language).toBe('en');

    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null, personaLanguage: null }));
    await s().loadLanguage();
    await s().restoreImpersonation();
    await vi.waitFor(() => expect(s().impersonation?.selection.personaId).toBe('finance'));
    expect(s().language).toBe('cz');
  });

  it('a boot language read that lands after the restore does not undo en', async () => {
    await s().switchToPersona('erasmus');
    useAppStore.setState(overlayWrite({ impersonation: null, personaLanguage: null }));
    // The boot's read of the saved language, held in IndexedDB until the
    // restore has applied Erasmus.
    const get = IndexedDBService.get.bind(IndexedDBService);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.spyOn(IndexedDBService, 'get').mockImplementation((async (store: never, key: never) => {
      if (key === 'reis_language') await gate;
      return get(store, key);
    }) as never);
    const slowRead = s().loadLanguage();
    await s().restoreImpersonation();
    expect(s().language).toBe('en');
    release();
    await slowRead;
    expect(s().language).toBe('en');
  });

  it('a background refresh keeps the language the admin picked meanwhile', async () => {
    await s().switchToPersona('erasmus');
    // A boot a day later restores Erasmus (English) and refetches it in the background.
    useAppStore.setState(overlayWrite({ impersonation: null, personaLanguage: null }));
    vi.setSystemTime(new Date(2026, 8, 28));
    const release = setup.gatedFetch(fetchImpersonation, 'Z-EXC-2');
    await s().restoreImpersonation();
    expect(s().language).toBe('en');
    // The admin picks Czech while the refresh is out; then it lands.
    await s().setLanguage('cz');
    release();
    await vi.waitFor(() => expect(codes()).toEqual(['Z-EXC-2']));
    expect(s().language).toBe('cz');
  });

  it('entering the demo restores the admin language', async () => {
    await s().switchToPersona('erasmus');
    await s().enterDemo();
    expect(s().impersonation).toBeNull();
    await vi.waitFor(() => expect(s().language).toBe('cz'));
  });

  it("the admin's own pick while Erasmus is active wins and is saved", async () => {
    await s().switchToPersona('erasmus');
    await s().setLanguage('cz');
    expect(s().language).toBe('cz');
    await s().loadLanguage();
    expect(s().language).toBe('cz');
    expect(await savedLanguage()).toBe('cz');
  });
});
