import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../api/campusMap', () => ({
  fetchBuildingRooms: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
}));
vi.mock('../../api/buildingModels', () => ({ fetchBuildingModel: vi.fn() }));

import { fetchBuildingModel } from '../../api/buildingModels';
import { hasBuildingModel, map3dEnabled } from '../../data/map/buildingModels';
import { useAppStore } from '../../store/useAppStore';
import { TiltToggle } from '../../components/Building3D/tilt/TiltToggle';
import { TiltButton } from '../../components/Building3D/tilt/TiltButton';
import { RoomDirections } from '../../components/CampusMap/RoomDirections';
import { RoomDirectionsNote } from '../../components/mobile/screens/map/RoomDirectionsNote';
import { q39Plan } from '../fixtures/q39Plan';

/**
 * The 3D map (a room in building Q tilts the map into the building) is merged
 * but OFF: it was judged on an emulator and in verify-ui, not yet by students.
 * A store build switches it on with `VITE_MAP3D=1`.
 *
 * Off has to mean nothing, on both trees: no model request to the reis-data
 * CDN, no 3D/2D control in the floor column (src/components/CampusMap/FloorStack.tsx),
 * no layer over the map (src/components/CampusMap/MapCanvas.tsx), and no three.js
 * chunk. Those two CampusMap files are shared, so the extension and the phone
 * get the same answer.
 *
 * Room directions (floor first: the entrance, the staircase, the room) ride the
 * same flag, in the detail panel, the phone's sheet and the tablet's rail. Off,
 * a selected room shows what it showed before: no steps, no note.
 *
 * The earlier design, a 3D card in the map sheet, rail, detail panel and hover
 * card, was rejected and removed; the last test keeps it from creeping back in
 * through one of those shells.
 */

const Q = 0;
afterEach(() => {
  vi.unstubAllEnvs();
  useAppStore.setState({ activeBuildingId: null, mapSelection: null, roomsByBuilding: {} });
});

/** Q39 on floor 3, with a staircase from the entrance floor up to it: a plan the
 *  directions can route, so only the flag decides whether they show. */
function seedQ39() {
  const { q39, rooms } = q39Plan();
  useAppStore.setState({
    roomsByBuilding: { [Q]: rooms },
    mapSelection: { kind: 'room', room: q39.properties },
  });
}
const directionShells = () =>
  createElement('div', null, createElement(RoomDirections), createElement(RoomDirectionsNote));

describe('the 3D map is dormant', () => {
  it('is switched off', () => {
    expect(map3dEnabled()).toBe(false);
    expect(hasBuildingModel(Q)).toBe(false);
  });

  it('switches on with VITE_MAP3D=1, so the checks below are not vacuous', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    expect(hasBuildingModel(Q)).toBe(true);
  });

  it('asks the CDN for no model when building Q loads', async () => {
    useAppStore.setState({ roomsByBuilding: {}, buildingModels: {} });
    await useAppStore.getState().loadMapBuilding(Q);
    expect(fetchBuildingModel).not.toHaveBeenCalled();
  });

  it('renders no 3D control and no tilted layer while Q is open', () => {
    useAppStore.setState({ activeBuildingId: Q });
    const { container } = render(
      createElement('div', null, createElement(TiltButton), createElement(TiltToggle))
    );
    expect(container.innerHTML).toBe('<div></div>');
  });

  it('shows no room directions, on any shell, for a selected room in Q', () => {
    seedQ39();
    const { container } = render(directionShells());
    expect(container.innerHTML).toBe('<div></div>');
  });

  it('shows them with VITE_MAP3D=1, so the check above is not vacuous', () => {
    vi.stubEnv('VITE_MAP3D', '1');
    seedQ39();
    const { getByTestId } = render(directionShells());
    expect(getByTestId('room-directions')).toBeTruthy();
    expect(getByTestId('room-directions-note')).toBeTruthy();
  });

  it('is reached only through the map, never a panel or card', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          if (p.includes(join('components', 'Building3D'))) continue;
          if (/from '[./]*\/?(components\/)?Building3D\//.test(readFileSync(p, 'utf-8')))
            importers.push(p.slice(p.indexOf('src/')));
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(importers.sort()).toEqual([
      'src/components/CampusMap/FloorStack.tsx',
      'src/components/CampusMap/MapCanvas.tsx',
    ]);
  });
});
