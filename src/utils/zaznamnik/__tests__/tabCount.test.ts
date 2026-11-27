import { it, expect } from 'vitest';
import { zaznamnikTabCount } from '../tabCount';
import type { SubjectZaznamnik } from '../../../types/zaznamnik';

const data = {
  ph: {
    sections: [
      {
        label: 'Body',
        arches: [
          { name: 'a', empty: false, columns: [], values: [] },
          { name: 'b', empty: true, columns: [], values: [] },
        ],
      },
    ],
    fetchedAt: 1,
  },
  vt: { tests: [{ name: 't' }, { name: 'u' }], fetchedAt: 1 },
} as unknown as SubjectZaznamnik;

it('counts filled arches, test attempts and boxes', () => {
  expect(zaznamnikTabCount(data, 3, false)).toBe(1 + 2 + 3);
});

it('has no count with neither records nor boxes', () => {
  expect(zaznamnikTabCount(undefined, 0, false)).toBeUndefined();
  expect(zaznamnikTabCount(null, 0, false)).toBeUndefined();
});

it('counts boxes alone', () => {
  expect(zaznamnikTabCount(undefined, 2, false)).toBe(2);
});

/**
 * Admin personas: the store is keyed by subject code, so a subject the persona
 * shares with the admin holds the ADMIN's marks, and the tab itself only says
 * "not available". The badge must not count them either.
 */
it('has no count while impersonating', () => {
  expect(zaznamnikTabCount(data, 3, true)).toBeUndefined();
});
