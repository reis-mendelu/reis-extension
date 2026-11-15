import { describe, it, expect } from 'vitest';
import { parseMendeluProfileResult } from '../peopleParserProfile';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REDESIGNED_EN = readFileSync(
  resolve(__dirname, '../../__tests__/fixtures/clovek-redesigned.en.html'),
  'utf-8'
);

describe('parseMendeluProfileResult', () => {
  // IS answers a search with exactly one match by showing that person's own
  // page; on the redesigned IS (2026-11-15) its name is a bold <span>.
  it('reads a single-match profile page from the redesigned IS', () => {
    const doc = new DOMParser().parseFromString(REDESIGNED_EN, 'text/html');
    const people = parseMendeluProfileResult(
      doc,
      'https://is.mendelu.cz/auth/lide/clovek.pl?id=900349'
    );
    expect(people).toHaveLength(1);
    expect(people[0]!.name).toBe('Jakub Dvořák');
  });
});
