import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { timetableBody, criteriaBody, readTimetableAnswer } from '../timetableQuery';
import { mergeDualLanguageLessons } from '../../schedule';
import type { RozvrhRef } from '../types';

const raw = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const FX = 'src/api/impersonation/__tests__/fixtures/';
const R: RozvrhRef = {
  id: '5769',
  z: '20260921',
  k: '20261213',
  label: 'Prezenční forma',
  period: 'ZS 2026/2027',
  faculty: 'PEF',
  form: 'prezenční',
  start: '21.09.2026',
  end: '20.12.2026',
};

describe('timetableBody', () => {
  it('asks for dated JSON over the rozvrh validity (verified live 2026-09-26)', () => {
    const p = new URLSearchParams(
      timetableBody(R, { program: '1889', rocnik: 1, skupina: 2 }, 'en', 'json')
    );
    expect(Object.fromEntries(p)).toMatchObject({
      lang: 'en',
      rozvrh: '5769',
      z: '20260921',
      k: '20261213',
      f: '0',
      program: '1889',
      rocnik: '1',
      skupina: '2',
      predmet: '0',
      format: 'json',
      typ_vypisu: 'konani',
      konani_od: '21.09.2026',
      konani_do: '20.12.2026',
      zobraz: 'Zobrazit',
    });
  });
  it('list format carries no konani range', () => {
    const p = new URLSearchParams(timetableBody(R, { program: '1889', rocnik: 1 }, 'cz', 'list'));
    expect(p.get('format')).toBe('list');
    expect(p.has('typ_vypisu')).toBe(false);
  });
  it('criteria body posts only the rozvrh selection', () => {
    expect(Object.fromEntries(new URLSearchParams(criteriaBody(R)))).toEqual({
      lang: 'cz',
      z: '20260921',
      k: '20261213',
      f: '0',
      studijni_zpet: '0',
      rozvrh: '5769',
    });
  });
});

describe('readTimetableAnswer', () => {
  it('reads real dated JSON into student-shaped lessons', () => {
    const a = readTimetableAnswer(raw(FX + 'rozvrh-bf-y1-g2.cz.json'));
    expect(a.kind).toBe('lessons');
    if (a.kind !== 'lessons') return;
    expect(a.lessons.length).toBeGreaterThan(0);
    expect(new Set(a.lessons.map((l) => l.courseCode))).toContain('EBC-MT');
  });
  it("blanks the VIEWER's studium IS stamps on lessons they are enrolled in themselves", () => {
    // The real response carried the admin's own studyId on EBC-PE (fixture: faked 100001).
    expect(raw(FX + 'rozvrh-bf-y1-g2.cz.json')).toContain('"studyId": "100001"');
    const a = readTimetableAnswer(raw(FX + 'rozvrh-bf-y1-g2.cz.json'));
    if (a.kind !== 'lessons') throw new Error('fixture');
    expect(a.lessons.every((l) => l.studyId === '' && l.periodId === '')).toBe(true);
  });
  it('treats the real no-results page as empty, in either language', () => {
    expect(
      readTimetableAnswer(raw('src/api/__tests__/fixtures/is-rozvrh-no-results.html')).kind
    ).toBe('empty');
    expect(
      readTimetableAnswer(raw('src/api/__tests__/fixtures/is-rozvrh-no-results-en.html')).kind
    ).toBe('empty');
  });
  it('treats anything else (login page, error) as failed — never as empty', () => {
    expect(readTimetableAnswer('<html>login</html>').kind).toBe('failed');
    expect(readTimetableAnswer('{not json').kind).toBe('failed');
  });
});

describe('mergeDualLanguageLessons', () => {
  it('adds EN names to CZ lessons by id+date+start', () => {
    const cz = readTimetableAnswer(raw(FX + 'rozvrh-bf-y1-g2.cz.json'));
    const en = readTimetableAnswer(raw(FX + 'rozvrh-bf-y1-g2.en.json'));
    if (cz.kind !== 'lessons' || en.kind !== 'lessons') throw new Error('fixture');
    const mt = mergeDualLanguageLessons(cz.lessons, en.lessons).find(
      (l) => l.courseCode === 'EBC-MT'
    )!;
    expect(mt.courseNameCs).toBe('Matematika');
    expect(mt.courseNameEn).toBe('Mathematics');
  });
});
