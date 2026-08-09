import { describe, it, expect } from 'vitest';
import { personInitials } from '../personInitials';

describe('personInitials', () => {
  it('takes the initials of the name, not of the degrees around it', () => {
    // "Ing. David Procházka, Ph.D." read left to right gives "ID" — the avatar
    // of every academic in IS said the same thing, because every one of them
    // starts with a title.
    expect(personInitials('Ing. David Procházka, Ph.D.')).toBe('DP');
  });

  it('handles a stack of titles', () => {
    expect(personInitials('doc. Ing. Jan Novák, Ph.D., MBA')).toBe('JN');
  });

  it('leaves a plain student name alone', () => {
    expect(personInitials('Dominik Holek')).toBe('DH');
  });

  it('falls back to the raw words when a name is nothing but titles', () => {
    // Never an empty circle: something legible beats nothing.
    expect(personInitials('Ph.D.')).toBe('P');
  });

  it('survives the shapes IS actually emits', () => {
    expect(personInitials('  Jan   Novák ')).toBe('JN');
    expect(personInitials('Novák')).toBe('N');
    expect(personInitials('')).toBe('');
  });
});
