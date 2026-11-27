import { describe, expect, it } from 'vitest';
import { isFirstPages, isKept, isSubjectPages } from '../isPages';

const BASE = 'https://is.mendelu.cz';
const IDS = { studium: '111', obdobi: '222', studentId: '333' };
const LIST =
  '<a href="../dok_server/slozka.pl?ds=1;id=41">Dokumenty</a>' +
  '<a href="../dok_server/slozka.pl?id=42">Dokumenty</a>' +
  '<a href="list.pl?studium=111;obdobi=222;predmet=7;prubezne=1">Průběžné</a>' +
  '<a href="list.pl?studium=111;obdobi=222;predmet=8;prubezne=1">Průběžné</a>' +
  '<a href="list.pl?studium=111;obdobi=222;predmet=8;test=1">Test</a>';

const all = () => [...isFirstPages(BASE, IDS), ...isSubjectPages(BASE, IDS, LIST)];

describe('the IS page list for snapshots', () => {
  it('has the pages a student checks, among them home, exams and the study plan', () => {
    const names = isFirstPages(BASE, IDS).map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(['index', 'exam-terms', 'study-plan', 'list']));
  });

  it("never keeps other students' data: no classmates, no exam sign-up lists", () => {
    for (const [name, url] of all()) {
      expect(name).not.toMatch(/spoluzaci/);
      expect(url).not.toMatch(/spoluzaci/);
    }
  });

  it('skips the catalogue: it is not the student and it does not change', () => {
    for (const [name, url] of all()) {
      expect(name).not.toMatch(/catalog|katalog|syllabus/);
      expect(url).not.toMatch(/\/katalog\//);
    }
  });

  it('opens no address that acts: logout, sign-up, "do not show again", downloads', () => {
    for (const [, url] of all()) {
      expect(url).not.toMatch(/logout|odhlas|prihlas|jiz_nezobrazovat|download=|get=/i);
    }
  });

  it('reads every subject folder and every subject záznamník, not only the first', () => {
    const names = isSubjectPages(BASE, IDS, LIST).map(([n]) => n);
    expect(names).toEqual([
      'slozka-41',
      'slozka-42',
      'zaznamnik-7-prubezne',
      'zaznamnik-8-prubezne',
      'zaznamnik-8-test',
    ]);
  });
});

describe('isKept (offline runs read a saved dump)', () => {
  it('keeps the listed pages and the per-subject ones, drops classmates and the catalogue', () => {
    expect(['index', 'slozka-41', 'zaznamnik-7-test'].every(isKept)).toBe(true);
    expect(['spoluzaci', 'terminy-info-spoluzaci', 'catalog-leaf', 'syllabus'].some(isKept)).toBe(
      false
    );
  });
});

describe('secrets never reach the archive', () => {
  it('skips the eduroam certificate page: it shows the certificate password as text', () => {
    for (const [name, url] of all()) {
      expect(name).not.toBe('certifikat');
      expect(url).not.toMatch(/certifikat/);
    }
    expect(isKept('certifikat')).toBe(false);
  });
});
