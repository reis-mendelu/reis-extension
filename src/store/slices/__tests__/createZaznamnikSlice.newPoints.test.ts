import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * "Nové body" stays on a subject until the student opens its záznamník, across
 * restarts: it is hydrated with the záznamník and cleared through the sync layer.
 */
const { db, idb } = vi.hoisted(() => {
  const db = new Map<string, unknown>();
  const idb = {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => void db.set(`${store}/${key}`, v)),
    getAllWithKeys: vi.fn(async () => []),
  };
  return { db, idb };
});
vi.mock('../../../services/storage', () => ({ IndexedDBService: idb }));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  INSTALL_ID_KEY: 'install_id',
  IndexedDBService: idb,
}));

import { useAppStore } from '../../useAppStore';
import { NEW_POINTS_META_KEY } from '../../../services/sync/zaznamnikNewPoints';

const PS = [{ label: 'IPv4-subnt-NAOPAK', value: '9' }];
const VWA = [{ label: '2', value: '1' }];

describe('záznamník new points in the store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.clear();
    useAppStore.setState({ zaznamnikNewPoints: {} } as never);
  });

  it('hydrates what is still unseen with the záznamník', async () => {
    db.set(`meta/${NEW_POINTS_META_KEY}`, { 'EBC-PS': PS });
    await useAppStore.getState().fetchZaznamnik();
    expect(useAppStore.getState().zaznamnikNewPoints).toEqual({ 'EBC-PS': PS });
  });

  it('opening a subject clears only that subject, on screen and stored', async () => {
    db.set(`meta/${NEW_POINTS_META_KEY}`, { 'EBC-PS': PS, 'EBC-VWA': VWA });
    useAppStore.getState().setZaznamnikNewPoints({ 'EBC-PS': PS, 'EBC-VWA': VWA });

    await useAppStore.getState().markZaznamnikSeen('EBC-PS');

    expect(useAppStore.getState().zaznamnikNewPoints).toEqual({ 'EBC-VWA': VWA });
    expect(db.get(`meta/${NEW_POINTS_META_KEY}`)).toEqual({ 'EBC-VWA': VWA });
  });

  it('opening a subject with nothing new writes nothing', async () => {
    useAppStore.getState().setZaznamnikNewPoints({ 'EBC-VWA': VWA });
    await useAppStore.getState().markZaznamnikSeen('EBC-PS');
    expect(idb.set).not.toHaveBeenCalledWith('meta', NEW_POINTS_META_KEY, expect.anything());
  });
});
