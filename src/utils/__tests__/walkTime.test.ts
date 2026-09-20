import { describe, it, expect } from 'vitest';
import { walkMinutes, WALK_M_PER_MIN } from '../walkTime';

describe('walkMinutes', () => {
  it('answers in whole minutes, because that is how a student thinks about a walk', () => {
    expect(walkMinutes(100)).toBe(1);
    expect(walkMinutes(436)).toBe(4);
    expect(walkMinutes(240)).toBe(2);
  });

  it('never says a walk takes zero minutes', () => {
    // The shortest route on campus is 25 m. "0 min" is not an answer.
    expect(walkMinutes(25)).toBe(1);
    expect(walkMinutes(1)).toBe(1);
    expect(walkMinutes(0)).toBe(1);
  });

  it('walks at the pace this campus is actually walked at', () => {
    // 6 km/h. Measured, not guessed: FRRMS to building Q through the botanical
    // garden is 1326 m and is walked in about 12 minutes, which is 110 m/min.
    // 100 is that, rounded back towards someone who is not in a hurry.
    expect(WALK_M_PER_MIN).toBe(100);
  });

  it('is honest about the walk that motivated the pace', () => {
    // FRRMS -> Q, 1326 m. The old 80 m/min printed 17 min for this and was
    // five minutes out, which on the way to a lecture is the whole question.
    expect(walkMinutes(1326)).toBe(13);
  });

  it('shrugs off a nonsense length rather than printing NaN on the map', () => {
    expect(walkMinutes(Number.NaN)).toBe(1);
    expect(walkMinutes(-50)).toBe(1);
  });
});
