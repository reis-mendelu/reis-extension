import { describe, it, expect } from 'vitest';
import { subjectsPageShape } from '../subjectsPageShape';

/**
 * Counts, never content: what `list.pl` looked like when the subject list
 * came back empty. Made-up fixtures — no real course, person or id.
 */
const row = (syllabus: boolean, folder: boolean) =>
  `<tr class="uis-hl-table"><td>${
    syllabus
      ? '<a href="/auth/katalog/syllabus.pl?predmet=1;lang=cz">XX1 Made up</a>'
      : 'XX1 Made up'
  }</td><td>${folder ? '<a href="../dok_server/slozka.pl?id=1">folder</a>' : ''}</td></tr>`;

const page = (rows: string, tableId = 'tmtab_1') =>
  `<html><body><a href="/system/logout.pl">x</a><table id="${tableId}">${rows}</table></body></html>`;

describe('subjectsPageShape', () => {
  it('counts rows and which of the two links each one has', () => {
    const shape = subjectsPageShape(page(row(true, true) + row(true, false) + row(false, false)));
    expect(shape).toEqual({
      tables: 1,
      table: true,
      rows: 3,
      syllabusLinks: 2,
      folderLinks: 1,
      signedIn: true,
    });
  });

  it('says so when the list sits in another table than the one read', () => {
    const shape = subjectsPageShape(page(row(true, true), 'tmtab_2'));
    expect(shape.table).toBe(false);
    expect(shape.tables).toBe(1);
    expect(shape.rows).toBe(0);
  });

  it('tells a signed-out page apart', () => {
    expect(subjectsPageShape('<html><body>login</body></html>').signedIn).toBe(false);
  });

  it('carries no text from the page', () => {
    const json = JSON.stringify(subjectsPageShape(page(row(true, true))));
    expect(json).not.toMatch(/Made up|XX1|predmet|slozka/);
  });
});
