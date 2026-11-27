import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../transport', () => ({ canBookLibrary: () => true, nativeBookingsHttp: vi.fn() }));

import { useLibraryStore } from '../libraryStore';
import { SAVED_KEY, SAVED_MAX_MS } from '../libraryCache';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';
import type { BookingsHttp } from '../bookingsBase';

const answer = (from: string, to: string): BookingsHttp =>
  vi.fn(async (req) => ({
    status: 200,
    data: {
      staffAvailabilityResponse: (req.data as { staffIds: string[] }).staffIds.map((staffId) => ({
        staffId,
        availabilityItems: [
          {
            status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
            startDateTime: { dateTime: from },
            endDateTime: { dateTime: to },
          },
        ],
      })),
    },
  }));
// Prague instants: the library's hours are Prague's, and CI runs in UTC.
const at = (iso: string) => new Date(`${iso}+01:00`);
const NOW = at('2026-11-27T18:40:00');
const hang: BookingsHttp = () => new Promise(() => undefined);
const known = () => Object.values(useLibraryStore.getState().blocks).some(Array.isArray);

beforeEach(async () => {
  useLibraryStore.getState().reset();
  await IndexedDBService.delete('meta', SAVED_KEY);
});

/** One read that succeeds, so the answer is on the device; then a "new start". */
async function saveAnAnswer() {
  await useLibraryStore.getState().load(answer('2026-11-27T07:00:00', '2026-11-27T19:00:00'), NOW);
  // The write to the device is not awaited by the read: wait until a restart can see it.
  await vi.waitFor(async () => {
    useLibraryStore.getState().reset();
    void useLibraryStore.getState().load(hang, new Date(NOW.getTime() + 60_000));
    await vi.waitFor(() => expect(known()).toBe(true), { timeout: 200 });
  });
  useLibraryStore.getState().reset();
}

describe('libraryStore: the last answer is shown at once while a new one is read', () => {
  it('shows what the library last said, marked with when, until the new answer arrives', async () => {
    await saveAnAnswer();
    const later = new Date(NOW.getTime() + 60 * 60_000);
    let finish!: () => void;
    const fresh = answer('2026-11-27T10:00:00', '2026-11-27T12:00:00');
    const slow: BookingsHttp = (req) => new Promise((r) => (finish = () => r(fresh(req))));
    const reading = useLibraryStore.getState().load(slow, later);
    await vi.waitFor(() => expect(known()).toBe(true));
    expect(useLibraryStore.getState().savedAt).toBe(NOW.getTime());
    expect(useLibraryStore.getState().status).toBe('loading');

    finish();
    await reading;
    expect(useLibraryStore.getState().savedAt).toBeNull();
    expect(useLibraryStore.getState().status).toBe('ready');
  });

  it('keeps showing the saved answer when the new read fails, and reads again next time', async () => {
    await saveAnAnswer();
    const failing: BookingsHttp = async () => ({ status: 500, data: null });
    await useLibraryStore.getState().load(failing, new Date(NOW.getTime() + 60_000));
    const s = useLibraryStore.getState();
    expect(known()).toBe(true);
    expect(s.savedAt).toBe(NOW.getTime());
    expect(s.status).not.toBe('offline');
    expect(s.fetchedAt).toBeNull();
  });

  it('does not use an answer older than half a day', async () => {
    await saveAnAnswer();
    const reading = useLibraryStore
      .getState()
      .load(hang, new Date(NOW.getTime() + SAVED_MAX_MS + 60_000));
    void reading;
    await new Promise((r) => setTimeout(r, 100));
    expect(known()).toBe(false);
    expect(useLibraryStore.getState().savedAt).toBeNull();
  });

  it('drops a copy that grew too old while it sat in memory, instead of keeping it on a failed read', async () => {
    const taken = new Date(NOW.getTime() - SAVED_MAX_MS - 60_000).getTime();
    useLibraryStore.setState({
      blocks: { 1: [{ status: 'free', start: '2026-11-26T07:00', end: '2026-11-26T19:00' }] },
      savedAt: taken,
    });
    const failing: BookingsHttp = async () => ({ status: 500, data: null });
    await useLibraryStore.getState().load(failing, NOW);
    const s = useLibraryStore.getState();
    expect(s.status).toBe('offline');
    expect(s.savedAt).toBeNull();
    expect(known()).toBe(false);
  });
});
