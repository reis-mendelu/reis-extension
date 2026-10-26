import { describe, it, expect, beforeEach } from 'vitest';
import { popoverPosition, formatDateLabel } from '../calendarPopover';

describe('popoverPosition', () => {
  beforeEach(() => {
    Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
  });

  it('sits to the right of the click, a little above it', () => {
    expect(popoverPosition({ x: 400, y: 300 }, 300, 200)).toEqual({ left: 414, top: 276 });
  });

  it('flips to the left of the click near the right edge', () => {
    expect(popoverPosition({ x: 1100, y: 300 }, 300, 200)).toEqual({ left: 786, top: 276 });
  });

  it('is pulled up off the bottom edge', () => {
    expect(popoverPosition({ x: 400, y: 750 }, 300, 200).top).toBe(592);
  });

  it('never goes above the top edge or past the left one', () => {
    expect(popoverPosition({ x: 0, y: 0 }, 300, 200)).toEqual({ left: 14, top: 8 });
    Object.assign(window, { innerWidth: 320 });
    expect(popoverPosition({ x: 200, y: 300 }, 300, 200).left).toBe(8);
  });
});

describe('formatDateLabel', () => {
  it('reads the block date in each language', () => {
    expect(formatDateLabel('20261121', 'cz')).toMatch(/21\. listopadu/);
    expect(formatDateLabel('20261121', 'en')).toMatch(/21 November/);
  });

  it('is empty for a malformed date', () => {
    expect(formatDateLabel('2026-11', 'cz')).toBe('');
  });
});
