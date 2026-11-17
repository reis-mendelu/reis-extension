import { describe, it, expect } from 'vitest';
import { parseGlobalPeopleResults } from '../peopleParserGlobal';

/**
 * hledani/index.pl after the UIS redesign (live on is.mendelu.cz since
 * 2026-11-15). The markup is the real page's, cut down; every name and id is
 * made up. The new header puts the signed-in student's own `clovek.pl` link in
 * `#menu-popup .user-info` on EVERY page, so a global search that found nobody
 * returned the student as its one "person" (checked live 2026-11-16:
 * "matematika" and "EBC-M" each listed exactly one person, the searcher).
 */
const HEADER = `<div id="menu-popup" data-active="false" data-page="1"><div class="menu-pages"><div class="items" data-page="1"><div class="user-info"><a target="_blank" href="/auth/lide/clovek.pl?id=900001;lang=cz">Jana Vzorová</a><div title="PEF B-EM prez [sem 1, roč 1]" class="ident">PEF B-EM prez [sem 1, roč 1]</div></div><div class="dvdr"></div></div></div></div>`;

const PEOPLE = `Výsledek hledání: <b >Novák</b><p ></p><a name="lide"></a><p ></p><big ><b >Osoby</b></big><p ></p><div class="small"><span class="small">Počet nalezených záznamů: 2</span></div><br /><span class='uf-icon xxs' data-dept-bullet style='background-color: #123456;'></span>&nbsp;<a href="../lide/clovek.pl?id=900002;lang=cz">Petr Testovací</a> - PEF B-EM prez [sem 1, roč 1]<br /><span class='uf-icon xxs' data-dept-bullet style='background-color: #654321;'></span>&nbsp;<a href="../lide/clovek.pl?id=900003;lang=cz">Ing. Eva Ukázková, Ph.D.</a> - ÚI PEF<br />`;

const page = (body: string) =>
  `<html><body><div class="wholepage">${HEADER}<div id="header"></div>${body}</div></body></html>`;

describe('parseGlobalPeopleResults on the redesigned IS', () => {
  it('does not list the signed-in student from the page header', () => {
    expect(parseGlobalPeopleResults(page('Výsledek hledání: <b >matematika</b>'))).toEqual([]);
  });

  it('still lists every real result', () => {
    const people = parseGlobalPeopleResults(page(PEOPLE));
    expect(people.map((p) => p.id)).toEqual(['900002', '900003']);
    expect(people[0]!.type).toBe('student');
    expect(people[1]!.type).toBe('teacher');
  });
});
