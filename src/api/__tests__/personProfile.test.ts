import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePersonProfile } from '../personProfile';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

const WITH_PRIVATE_EMAIL = fixture('clovek-private-email.html');
const NO_PRIVATE_EMAIL = fixture('clovek-no-private-email.html');
const REDESIGNED_EN = fixture('clovek-redesigned.en.html');

describe('parsePersonProfile', () => {
  it('extracts the universal fields from Dvořák profile', () => {
    const r = parsePersonProfile(WITH_PRIVATE_EMAIL, 900349);
    expect(r).not.toBeNull();
    expect(r!.name).toMatch(/Dvořák/);
    expect(r!.universityEmail).toBe('xdvorak@node.mendelu.cz');
    expect(r!.privateEmail).toBe('jakubdvorak@protonmail.com');
    expect(r!.programmeCode).toBe('B0613A140025');
    expect(r!.programmeName).toMatch(/Otevřená informatika/);
    expect(r!.studyTypeSentence).toMatch(/Bakalářský/);
    expect(r!.studyTypeSentence).toMatch(/prezenční\s*forma/);
    expect(r!.yearSemesterSentence).toMatch(/\d+\.\s*ročník/);
    expect(r!.yearSemesterSentence).toMatch(/\d+\.\s*semestr studia/);
  });

  it('handles missing private email (Svobodová)', () => {
    const r = parsePersonProfile(NO_PRIVATE_EMAIL, 901037);
    expect(r).not.toBeNull();
    expect(r!.name.length).toBeGreaterThan(0);
    expect(r!.universityEmail).toBeTruthy();
    expect(r!.privateEmail).toBeNull();
    expect(r!.programmeCode).toBe('B0612P140001');
    expect(r!.programmeName).toMatch(/Administrace/);
  });

  it('returns null when html has no name node', () => {
    const r = parsePersonProfile('<html><body>nothing</body></html>', 1);
    expect(r).toBeNull();
  });

  // The UIS redesign (is.mendelu.cz, 2026-11-15) prints the name as a bold
  // <span> instead of <b><font size="+1">, so every profile came back null.
  // Table from a real clovek.pl that day, identity replaced; the programme row
  // is still a <b>.
  it('reads the name from the redesigned IS', () => {
    const r = parsePersonProfile(REDESIGNED_EN, 900349);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Jakub Dvořák');
    expect(r!.universityEmail).toBe('xdvorak@node.mendelu.cz');
    expect(r!.programmeCode).toBe('B0613A140025');
  });
});
