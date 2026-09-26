import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { SceneInput } from '../scene';

const createBuildingScene = vi.fn();
vi.mock('../scene', () => ({
  createBuildingScene: (canvas: HTMLCanvasElement, input: SceneInput) =>
    createBuildingScene(canvas, input),
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
const noopScene = { resize: () => {}, dispose: () => {} };

const renderCard = () =>
  render(
    <div>
      <p>rest of the app</p>
      <Building3DCard
        target={{ buildingId: 0, floorLevel: 3, roomId: 1, label: 'Q32' }}
        fallback={<div data-testid="flat-thumbnail" />}
      />
    </div>
  );
const canvas = () => document.querySelector('canvas[data-testid="building-3d-canvas"]');

beforeEach(() => {
  resetWebGL2Probe(true);
  createBuildingScene.mockReset();
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

describe('Building3DCanvas when drawing fails', () => {
  // A device that advertises WebGL2 and still cannot build a renderer: seen in
  // an embedded browser, where the throw came out of the effect and blanked the app.
  it('shows the flat plan when the renderer cannot be built, and stops trying for the session', async () => {
    createBuildingScene.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'precision')");
    });
    renderCard();
    // The flat plan also shows while the lazy chunk loads, so wait for the
    // failure itself before judging what replaced the canvas.
    await waitFor(() => expect(hasWebGL2()).toBe(false));
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(canvas()).toBeNull();
    expect(screen.getByText('rest of the app')).toBeInTheDocument();
  });

  // Routine on iOS (backgrounding, memory pressure, the context cap): one loss
  // must not switch the pilot off until the app restarts.
  it('falls back for a lost context but lets the next card try again', async () => {
    createBuildingScene.mockReturnValue(noopScene);
    renderCard();
    await waitFor(() => expect(canvas()).not.toBeNull());
    canvas()!.dispatchEvent(new Event('webglcontextlost'));
    await waitFor(() => expect(canvas()).toBeNull());
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(hasWebGL2()).toBe(true);
  });

  it('falls back when the model cannot be parsed, instead of drawing an empty ground', async () => {
    createBuildingScene.mockImplementation((_c: HTMLCanvasElement, input: SceneInput) => {
      queueMicrotask(() => input.onFailure?.(new Error('bad glb')));
      return noopScene;
    });
    renderCard();
    await waitFor(() => expect(createBuildingScene).toHaveBeenCalled());
    await waitFor(() => expect(canvas()).toBeNull());
    expect(screen.getByTestId('flat-thumbnail')).toBeInTheDocument();
    expect(hasWebGL2()).toBe(true);
  });
});
