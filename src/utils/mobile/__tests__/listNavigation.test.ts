import { describe, it, expect } from 'vitest';
import { nextSelectedIndex } from '../listNavigation';

describe('nextSelectedIndex', () => {
  // Nothing selected yet: the first Down lands on the first row, and the first
  // Up on the LAST — which is what a keyboard user reaching backwards expects,
  // and what the desktop SearchBar already does.
  it('enters the list from either end', () => {
    expect(nextSelectedIndex(-1, 5, 'ArrowDown')).toBe(0);
    expect(nextSelectedIndex(-1, 5, 'ArrowUp')).toBe(4);
  });

  it('moves within the list', () => {
    expect(nextSelectedIndex(1, 5, 'ArrowDown')).toBe(2);
    expect(nextSelectedIndex(1, 5, 'ArrowUp')).toBe(0);
  });

  // Wrapping, not stopping: a short list is the common case here — three
  // recents — and a cursor that sticks at the bottom reads as broken.
  it('wraps at both ends', () => {
    expect(nextSelectedIndex(4, 5, 'ArrowDown')).toBe(0);
    expect(nextSelectedIndex(0, 5, 'ArrowUp')).toBe(4);
  });

  it('leaves the selection alone for any other key', () => {
    expect(nextSelectedIndex(2, 5, 'Enter')).toBeNull();
    expect(nextSelectedIndex(2, 5, 'a')).toBeNull();
  });

  // An empty list is the state this sheet spends most of its life in — two
  // characters typed, nothing back yet. Arrowing there must not select a row
  // that does not exist and then "activate" it on Enter.
  it('selects nothing in an empty list', () => {
    expect(nextSelectedIndex(-1, 0, 'ArrowDown')).toBe(-1);
    expect(nextSelectedIndex(-1, 0, 'ArrowUp')).toBe(-1);
  });

  // A stale index outliving its list — results arrive and replace a longer
  // set — must not leave the cursor pointing past the end.
  it('pulls a stale index back inside the list', () => {
    expect(nextSelectedIndex(9, 3, 'ArrowDown')).toBe(0);
    expect(nextSelectedIndex(9, 3, 'ArrowUp')).toBe(2);
  });
});
