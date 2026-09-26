import { describe, expect, it } from 'vitest';
import { clampPitch, dragBy, springToward, PITCH_MIN, PITCH_MAX } from '../orbit';

describe('orbit maths', () => {
  it('spins around the building with a horizontal drag and tilts with a vertical one', () => {
    const next = dragBy({ azimuth: 200, pitch: 35 }, 100, -50);
    expect(next.azimuth).not.toBe(200);
    expect(next.pitch).toBeGreaterThan(35);
  });

  it('never tilts under the ground or straight down', () => {
    expect(clampPitch(-40)).toBe(PITCH_MIN);
    expect(clampPitch(120)).toBe(PITCH_MAX);
  });

  it('springs back to the default view and settles exactly on it', () => {
    let view = { azimuth: 300, pitch: 60 };
    const home = { azimuth: 215, pitch: 35 };
    let steps = 0;
    while ((view.azimuth !== home.azimuth || view.pitch !== home.pitch) && steps < 500) {
      view = springToward(view, home, 1 / 60);
      steps++;
    }
    expect(view).toEqual(home);
    expect(steps).toBeLessThan(120); // under two seconds at 60 fps
  });

  it('takes the short way round', () => {
    const view = springToward({ azimuth: 350, pitch: 35 }, { azimuth: 10, pitch: 35 }, 1 / 60);
    expect(view.azimuth === 0 || view.azimuth > 350 || view.azimuth < 10).toBe(true);
  });
});
