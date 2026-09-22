import { describe, it, expect } from 'vitest';
import { isGateOpen, GARDEN_HOURS } from '../gateHours';

// 2026-09-21 is a Monday, 2026-09-25 a Friday, 2026-09-26 a Saturday,
// 2026-09-27 a Sunday.
const on = (iso: string) => new Date(iso);

describe('isGateOpen("garden")', () => {
  it('is open across the whole teaching day on a weekday', () => {
    expect(isGateOpen('garden', on('2026-09-21T06:00:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-21T12:00:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-21T19:59:00'))).toBe(true);
  });

  it('is shut before six and from eight', () => {
    expect(isGateOpen('garden', on('2026-09-21T05:59:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-21T20:00:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-21T23:30:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-21T00:30:00'))).toBe(false);
  });

  it('is open on a Friday and shut on the Saturday after it', () => {
    expect(isGateOpen('garden', on('2026-09-25T12:00:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-26T12:00:00'))).toBe(false);
  });

  it('is shut on a Sunday whatever the hour', () => {
    expect(isGateOpen('garden', on('2026-09-27T08:00:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-27T12:00:00'))).toBe(false);
  });

  it('uses the STUDENT hours, not the published visitor tariff', () => {
    // arboretum.mendelu.cz publishes Mon-Fri 07:00-15:00 for the paying
    // public. Students tap an ISIC on the gate and get 06:00-20:00. Routing by
    // the published hours would shut the shortcut five hours early, across
    // most of the afternoon teaching block.
    expect(GARDEN_HOURS.fromHour).toBe(6);
    expect(GARDEN_HOURS.toHour).toBe(20);
    expect(isGateOpen('garden', on('2026-09-21T06:30:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-21T16:00:00'))).toBe(true);
  });

  it('treats an unknown gate as open, because a gate nobody modelled is a path', () => {
    expect(isGateOpen('turnstile-that-does-not-exist', on('2026-09-27T23:00:00'))).toBe(true);
  });
});
