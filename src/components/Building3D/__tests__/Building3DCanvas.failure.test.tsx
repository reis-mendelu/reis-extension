import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// A device that advertises WebGL2 and still cannot build a renderer: seen in an
// embedded browser, where the throw came out of the effect and blanked the app.
vi.mock('../scene', () => ({
  createBuildingScene: () => {
    throw new TypeError("Cannot read properties of null (reading 'precision')");
  },
}));

import { Building3DCard } from '../Building3DCard';
import { hasWebGL2, resetWebGL2Probe } from '../webgl';
import { useAppStore } from '../../../store/useAppStore';
import type { BuildingModel } from '../../../types/buildingModel';

const MODEL = {
  glb: new ArrayBuffer(8),
  meta: { name: 'Q', attribution: 'x', storeys: [] },
  fetchedAt: 1,
} as unknown as BuildingModel;

beforeEach(() => {
  resetWebGL2Probe(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useAppStore.setState({
    buildingModels: { 0: MODEL },
    roomsByBuilding: { 0: { type: 'FeatureCollection', features: [] } },
  });
});
afterEach(() => {
  resetWebGL2Probe();
  vi.restoreAllMocks();
});

describe('Building3DCanvas when the renderer cannot be built', () => {
  it('shows the flat plan instead of taking the app down, and stops trying for the session', async () => {
    render(
      <div>
        <p>rest of the app</p>
        <Building3DCard
          target={{ buildingId: 0, floorLevel: 3, roomId: 1, label: 'Q32' }}
          fallback={<div data-testid="flat-thumbnail" />}
        />
      </div>
    );
    // The flat plan also shows while the lazy chunk loads, so wait for the
    // failure itself before judging what replaced the canvas.
    await waitFor(() => expect(hasWebGL2()).toBe(false));
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(screen.queryByTestId('building-3d-canvas')).toBeNull();
    expect(screen.getByText('rest of the app')).toBeInTheDocument();
  });
});
