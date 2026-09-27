import { describe, expect, it } from 'vitest';
import { makeProjector, metresPerDegree } from '../projection';

const Q_ANCHOR: [number, number] = [16.614247303030304, 49.20959154545455];

describe('makeProjector', () => {
  const project = makeProjector(Q_ANCHOR);

  it('puts the anchor at the origin', () => {
    const [x, z] = project(Q_ANCHOR);
    expect(x).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it('maps east to +x and north to -z, in metres', () => {
    const [east] = project([Q_ANCHOR[0] + 0.001, Q_ANCHOR[1]]);
    const [, north] = project([Q_ANCHOR[0], Q_ANCHOR[1] + 0.001]);
    // 0.001° at Brno's latitude: ~72.9 m of longitude, ~111.2 m of latitude.
    expect(east).toBeCloseTo(72.9, 0);
    expect(north).toBeCloseTo(-111.2, 1);
  });

  it('uses the same series as the reis-data generator (scripts/q3d/geometry.mjs)', () => {
    // Values the generator produces for Q's latitude; a drift here would float
    // every room outline off the model.
    const m = metresPerDegree(49.20959154545455);
    expect(m.lat).toBeCloseTo(111213.76, 1);
    expect(m.lng).toBeCloseTo(72864.3, 1);
  });
});
