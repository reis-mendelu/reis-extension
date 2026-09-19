import { describe, it, expect } from 'vitest';
import { walkMinutes, WALK_M_PER_MIN } from '../walkTime';

describe('walkMinutes', () => {
  it('answers in whole minutes, because that is how a student thinks about a walk', () => {
    expect(walkMinutes(80)).toBe(1);
    expect(walkMinutes(436)).toBe(5);
    expect(walkMinutes(240)).toBe(3);
  });

  it('never says a walk takes zero minutes', () => {
    // The shortest route on campus is 25 m. "0 min" is not an answer.
    expect(walkMinutes(25)).toBe(1);
    expect(walkMinutes(1)).toBe(1);
    expect(walkMinutes(0)).toBe(1);
  });

  it('walks at a campus pace, not a race', () => {
    // 4.8 km/h — someone with a bag, crossing a courtyard, not a pedestrian
    // in a routing benchmark.
    expect(WALK_M_PER_MIN).toBe(80);
  });

  it('shrugs off a nonsense length rather than printing NaN on the map', () => {
    expect(walkMinutes(Number.NaN)).toBe(1);
    expect(walkMinutes(-50)).toBe(1);
  });
});
