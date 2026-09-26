import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/campusMap', () => ({ fetchBuildingRooms: vi.fn() }));
vi.mock('../../../api/buildingModels', () => ({ fetchBuildingModel: vi.fn() }));

import { fetchBuildingRooms } from '../../../api/campusMap';
import { fetchBuildingModel } from '../../../api/buildingModels';
import { useAppStore } from '../../useAppStore';
import type { BuildingModel } from '../../../types/buildingModel';

const MODEL = {
  glb: new ArrayBuffer(8),
  meta: { name: 'Q' },
  fetchedAt: 1,
} as unknown as BuildingModel;

beforeEach(() => {
  vi.mocked(fetchBuildingRooms)
    .mockReset()
    .mockResolvedValue({ type: 'FeatureCollection', features: [] });
  vi.mocked(fetchBuildingModel).mockReset().mockResolvedValue(MODEL);
  useAppStore.setState({ roomsByBuilding: {}, buildingModels: {} });
});

describe('loadBuildingModel', () => {
  it('rides along with every floor-plan load of a building that has a model', async () => {
    await useAppStore.getState().loadRoomGeometry('Q01');
    await vi.waitFor(() => expect(useAppStore.getState().buildingModels[0]).toBe(MODEL));
    expect(fetchBuildingModel).toHaveBeenCalledWith(0);
  });

  it('never asks for a building without one', async () => {
    await useAppStore.getState().loadRoomGeometry('A01'); // building 54678
    expect(fetchBuildingModel).not.toHaveBeenCalled();
    expect(useAppStore.getState().buildingModels).toEqual({});
  });

  it('downloads once, however many rooms are hovered at the same time', async () => {
    await Promise.all(['Q01', 'Q02', 'Q03'].map((r) => useAppStore.getState().loadRoomGeometry(r)));
    await useAppStore.getState().loadRoomGeometry('Q04');
    await vi.waitFor(() => expect(useAppStore.getState().buildingModels[0]).toBe(MODEL));
    expect(fetchBuildingModel).toHaveBeenCalledTimes(1);
  });

  it('remembers a building whose model cannot be had, so the card falls back without re-asking', async () => {
    vi.mocked(fetchBuildingModel).mockResolvedValue(null);
    await useAppStore.getState().loadBuildingModel(0);
    expect(useAppStore.getState().buildingModels[0]).toBe('failed');
    await useAppStore.getState().loadBuildingModel(0);
    expect(fetchBuildingModel).toHaveBeenCalledTimes(1);
  });

  it('records a thrown fetch as failed instead of leaving the card waiting', async () => {
    vi.mocked(fetchBuildingModel).mockRejectedValue(new Error('offline'));
    await useAppStore.getState().loadBuildingModel(0);
    expect(useAppStore.getState().buildingModels[0]).toBe('failed');
  });
});
