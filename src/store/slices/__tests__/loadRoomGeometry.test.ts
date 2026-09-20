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

  it('does not refetch geometry already in the store', async () => {
    useAppStore.setState({
      roomsByBuilding: { 54678: { type: 'FeatureCollection', features: [] } },
    });
    await useAppStore.getState().loadRoomGeometry('A01');
    expect(fetchBuildingRooms).not.toHaveBeenCalled();
  });
});
