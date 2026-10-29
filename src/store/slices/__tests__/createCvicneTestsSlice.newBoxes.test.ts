import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Odevzdavarna } from '../../../api/odevzdavarny';

/**
 * A new box stays in Novinky until the student opens its subject's záznamník,
 * across restarts: hydrated with the boxes, cleared through the sync layer.
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
vi.mock('../../../utils/userParams', () => ({
  getUserParams: vi.fn(async () => ({ studium: 'st', obdobi: 'ob' })),
}));

import { useAppStore } from '../../useAppStore';
import { NEW_BOXES_META_KEY } from '../../../services/sync/newSubmissionBoxes';

const box = (id: string, courseId: string): Odevzdavarna => ({
  courseId,
  courseNameCs: 'X',
  courseNameEn: 'X',
  name: `Box ${id}`,
  type: '',
  deadline: '20.12.2026 23:59',
  odevzdavarnaId: id,
  fileCount: 0,
  uploadUrl: 'https://is.mendelu.cz/x',
});

describe('new submission boxes in the store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.clear();
    useAppStore.setState({
      odevzdavarny: [],
      odevzdavarnyStatus: 'idle',
      odevzdavarnyNew: [],
      odevzdavarnySeenNew: [],
      studiumId: 'st',
      obdobiId: 'ob',
      subjects: {
        data: { 'EBC-MAT': { subjectId: 'M' }, 'EBC-PJ': { subjectId: 'J' } },
      },
    } as never);
  });

  it('hydrates what is still unseen with the boxes', async () => {
    db.set('odevzdavarny/st_ob', [box('1', 'M')]);
    db.set(`meta/${NEW_BOXES_META_KEY}`, ['1']);
    await useAppStore.getState().fetchOdevzdavarny();
    expect(useAppStore.getState().odevzdavarnyNew).toEqual(['1']);
  });

  it("opening a subject clears only that subject's boxes, on screen and stored", async () => {
    useAppStore.setState({ odevzdavarny: [box('1', 'M'), box('2', 'J')] } as never);
    db.set(`meta/${NEW_BOXES_META_KEY}`, ['1', '2']);
    useAppStore.getState().setOdevzdavarnyNew(['1', '2']);

    await useAppStore.getState().markBoxesSeen('EBC-MAT');

    expect(useAppStore.getState().odevzdavarnyNew).toEqual(['2']);
    expect(db.get(`meta/${NEW_BOXES_META_KEY}`)).toEqual(['2']);
    // Seen, but still marked "Nová" for the rest of this run.
    expect(useAppStore.getState().odevzdavarnySeenNew).toEqual(['1']);
  });

  // A sync answered while the clear waited its turn put the box back on
  // screen; what is stored after the clear wins.
  it('a box a racing sync put back on screen is dropped once the clear lands', async () => {
    useAppStore.setState({ odevzdavarny: [box('1', 'M')] } as never);
    db.set(`meta/${NEW_BOXES_META_KEY}`, ['1']);
    useAppStore.getState().setOdevzdavarnyNew(['1']);
    const marking = useAppStore.getState().markBoxesSeen('EBC-MAT');
    useAppStore.getState().setOdevzdavarnyNew(['1']);
    await marking;
    expect(useAppStore.getState().odevzdavarnyNew).toEqual([]);
  });

  it('opening a subject with no new box writes nothing', async () => {
    useAppStore.setState({ odevzdavarny: [box('2', 'J')] } as never);
    useAppStore.getState().setOdevzdavarnyNew(['2']);
    await useAppStore.getState().markBoxesSeen('EBC-MAT');
    expect(idb.set).not.toHaveBeenCalledWith('meta', NEW_BOXES_META_KEY, expect.anything());
  });
});
