import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

// Q's 3D model is not what these tests are about — only when the sheet opens for it.
vi.mock('../../../../../api/buildingModels', () => ({
  fetchBuildingModel: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../../api/campusMap', () => ({
  fetchBuildingRooms: vi.fn().mockResolvedValue(null),
}));

import { MapSheet } from '../MapSheet';
import { resetWebGL2Probe } from '../../../../Building3D/webgl';
import { useAppStore } from '../../../../../store/useAppStore';
import type { RoomProperties } from '../../../../../types/campusMap';

const Q32_TAPPED = {
  id: 176,
  buildingId: 0,
  floorId: 2,
  floorLevel: 3,
  name: 'Q32',
  nickname: null,
  type: 'classroom',
  category: 'teaching',
  label: 'Classroom',
  passportNumber: 'BA39N4042',
  seats: 30,
  hasProjector: true,
  hasWhiteboard: true,
  code: null,
} as RoomProperties;

/**
 * A room someone came looking for — a lesson's pin, or search — opens the sheet
 * on its 3D card. A room tapped while exploring the floor plan does not: pulling
 * the sheet up over the plan being read answers a question nobody asked.
 */
describe('MapSheet and the 3D building card', () => {
  beforeEach(() => {
    resetWebGL2Probe(true);
    useAppStore.setState({
      language: 'cz',
      mapSheetState: 'peek',
      mapSelection: null,
      buildingModels: {},
    });
  });
  afterEach(() => resetWebGL2Probe());

  it('opens on a Q room focused from a lesson or search', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusRoomByCode('Q32'));
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('stays where it is for a Q room tapped on the plan', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().selectMapRoom(Q32_TAPPED));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('stays at peek for a room in a building without a model', () => {
    render(<MapSheet />);
    act(() => useAppStore.getState().focusRoomByCode('A01'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('stays at peek on a device that cannot draw 3D', () => {
    resetWebGL2Probe(false);
    render(<MapSheet />);
    act(() => useAppStore.getState().focusRoomByCode('Q32'));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });
});
