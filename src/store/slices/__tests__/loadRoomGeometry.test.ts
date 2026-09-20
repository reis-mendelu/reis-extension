import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));

import { fetchBuildingRooms } from '../../../api/campusMap';
import { useAppStore } from '../../useAppStore';

/**
 * The store-side half of taking the fetch out of `RoomThumbnail`'s effect.
 *
 * The hover card knows a room STRING ("A01", or "Q01 (Poříčí)"); the loader
 * wants a building id. Resolving between the two is exactly the knowledge that
 * had leaked into the component, so it lives here now, on the same resolver the
 * rest of the app uses.
 */
beforeEach(() => {
  vi.mocked(fetchBuildingRooms).mockReset();
  vi.mocked(fetchBuildingRooms).mockResolvedValue({ type: 'FeatureCollection', features: [] });
  useAppStore.setState({ roomsByBuilding: {} });
});

describe('loadRoomGeometry', () => {
  it('resolves a hall known only by its nickname and loads its building', async () => {
    await useAppStore.getState().loadRoomGeometry('A01'); // BA01N1052, building 54678
    expect(fetchBuildingRooms).toHaveBeenCalledWith(54678);
  });

  it('accepts the bracketed form a timetable prints', async () => {
    await useAppStore.getState().loadRoomGeometry('Q01 (Poříčí)'); // building 0
    expect(fetchBuildingRooms).toHaveBeenCalledWith(0);
  });

  it('does nothing for a room the dataset does not carry', async () => {
    await useAppStore.getState().loadRoomGeometry('X02');
    expect(fetchBuildingRooms).not.toHaveBeenCalled();
  });

  // `loadMapBuilding` only skips geometry it has ALREADY stored, so two reveals
  // while the first request is still in flight both used to reach the network.
  // A schedule full of Q rooms makes that easy to hit: hover Q01, then Q02 a
  // moment later, and the same large geojson is fetched twice on a cold cache.
  it('fetches once when two rooms in a building are revealed together', async () => {
    let release!: () => void;
    vi.mocked(fetchBuildingRooms).mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve({ type: 'FeatureCollection', features: [] });
      })
    );
    const first = useAppStore.getState().loadRoomGeometry('Q01'); // building 0
    const second = useAppStore.getState().loadRoomGeometry('Q02'); // same building
    release();
    await Promise.all([first, second]);
    expect(fetchBuildingRooms).toHaveBeenCalledTimes(1);
  });

  // ...but a failed request must not poison the building forever.
  it('lets a later reveal retry after a failed fetch', async () => {
    vi.mocked(fetchBuildingRooms).mockRejectedValueOnce(new Error('offline'));
    await useAppStore.getState().loadRoomGeometry('Q01');
    await useAppStore.getState().loadRoomGeometry('Q01');
    expect(fetchBuildingRooms).toHaveBeenCalledTimes(2);
  });

  it('does not refetch geometry already in the store', async () => {
    useAppStore.setState({
      roomsByBuilding: { 54678: { type: 'FeatureCollection', features: [] } },
    });
    await useAppStore.getState().loadRoomGeometry('A01');
    expect(fetchBuildingRooms).not.toHaveBeenCalled();
  });
});
