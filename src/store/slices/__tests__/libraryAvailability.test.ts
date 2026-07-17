import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/libraryAvailability', () => ({
  fetchLibraryAvailability: vi.fn(async () => [
    { staffGuid: 'g1', serviceId: 's1', webUrl: 'u', leadMinutes: 60, blocks: [] },
  ]),
}));

import { useAppStore } from '@/store/useAppStore';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';

describe('loadLibraryAvailability', () => {
  beforeEach(() => {
    useAppStore.setState({ libraryAvailability: {}, libraryAvailabilityLoaded: false });
    vi.clearAllMocks();
  });

  it('populates libraryAvailability keyed by staffGuid', async () => {
    await useAppStore.getState().loadLibraryAvailability();
    expect(useAppStore.getState().libraryAvailability.g1!.webUrl).toBe('u'); // safe: populated above
    expect(useAppStore.getState().libraryAvailabilityLoaded).toBe(true);
  });

  it('does not refetch once loaded', async () => {
    await useAppStore.getState().loadLibraryAvailability();
    await useAppStore.getState().loadLibraryAvailability();
    expect(fetchLibraryAvailability).toHaveBeenCalledTimes(1);
  });
});
