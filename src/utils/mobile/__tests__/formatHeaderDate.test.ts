import { describe, it, expect } from 'vitest';
import { formatHeaderDate } from '../formatHeaderDate';

describe('formatHeaderDate', () => {
  const thursday = new Date(2026, 10, 26);

  it('spells the weekday out by default — the lunch sheet has the room', () => {
    expect(formatHeaderDate(thursday, 'cs')).toBe('Čtvrtek 26. listopadu');
  });

  it('abbreviates it on request, capitalised, for the calendar header', () => {
    expect(formatHeaderDate(thursday, 'cs', 'short')).toBe('Čt 26. listopadu');
    expect(formatHeaderDate(thursday, 'en', 'short')).toBe('Thu, November 26');
  });
});
