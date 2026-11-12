import { describe, it, expect } from 'vitest';
import { signalShare } from '../signalShare';

const usage = [
  { day: '2026-11-05', active: 100 },
  { day: '2026-11-06', active: 200 },
  { day: '2026-11-07', active: 100 },
];

describe('signalShare', () => {
  // "10 % of daily installs opened Vývěska": installs with the signal on a day
  // over that day's installs, pooled across the window — a quiet Sunday must
  // not weigh as much as a Monday in week 1.
  it('pools the window: sum of signal installs over sum of daily installs', () => {
    const daily = [
      { day: '2026-11-05', installs: 10 },
      { day: '2026-11-06', installs: 40 },
    ];
    // (10 + 40 + 0) / (100 + 200 + 100)
    expect(signalShare(daily, usage)).toBeCloseTo(0.125);
  });

  // A day with installs and no signal is still a day the signal could have
  // happened on; dropping it would inflate the share.
  it('counts days without a signal row in the denominator', () => {
    expect(signalShare([{ day: '2026-11-05', installs: 10 }], usage)).toBeCloseTo(10 / 400);
  });

  // The two numbers come from different RPCs; a signal day the usage read does
  // not cover has nothing to be a share of.
  it('ignores signal days the usage read does not cover', () => {
    const daily = [
      { day: '2026-10-01', installs: 999 },
      { day: '2026-11-07', installs: 50 },
    ];
    expect(signalShare(daily, usage)).toBeCloseTo(50 / 400);
  });

  it('skips days with no (or a withheld) install count', () => {
    const u = [
      { day: '2026-11-06', active: -1 },
      { day: '2026-11-07', active: 0 },
      { day: '2026-11-08', active: 50 },
    ];
    const daily = [
      { day: '2026-11-06', installs: 5 },
      { day: '2026-11-08', installs: 5 },
    ];
    expect(signalShare(daily, u)).toBeCloseTo(0.1);
  });

  // The daily count skips an install with no student signed in (staff on IS
  // with the extension); the feature counters do not. A day can therefore have
  // more signal installs than daily installs — capped per day, never > 100 %.
  it('caps a day at its own install count', () => {
    const u = [
      { day: '2026-11-06', active: 10 },
      { day: '2026-11-07', active: 10 },
    ];
    const daily = [
      { day: '2026-11-06', installs: 12 },
      { day: '2026-11-07', installs: 5 },
    ];
    expect(signalShare(daily, u)).toBeCloseTo(15 / 20);
  });

  it('is null when there is no denominator at all', () => {
    expect(signalShare([{ day: '2026-11-05', installs: 3 }], [])).toBeNull();
    expect(signalShare([], [{ day: '2026-11-05', active: 0 }])).toBeNull();
  });
});
