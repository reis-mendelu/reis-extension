/**
 * What `list.pl` looked like, as counts: read beside `parseSubjectFolders`
 * (`./subjects.ts`), never instead of it, and it changes nothing that parser
 * returns. The selectors mirror the parser's on purpose — the point is to say
 * how many rows it was offered and which of the two links it requires each
 * one had, so an empty subject list in a report can be told apart:
 *
 * - no `#tmtab_1` at all, or the list in another table → `table: false`
 * - rows that lack a document-server folder link → `folderLinks < rows`
 * - a signed-out page → `signedIn: false`
 *
 * Counts and booleans only: no text, href or id leaves this function.
 */
export interface SubjectsPageShape {
  /** `tmtab_*` tables on the page, of which the parser reads only `tmtab_1`. */
  tables: number;
  table: boolean;
  rows: number;
  syllabusLinks: number;
  folderLinks: number;
  signedIn: boolean;
}

export function subjectsPageShape(html: string): SubjectsPageShape {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('#tmtab_1');
  const rows = table ? Array.from(table.querySelectorAll('tr.uis-hl-table')) : [];
  const count = (sel: string) => rows.filter((r) => r.querySelector(sel)).length;
  return {
    tables: doc.querySelectorAll('table[id^="tmtab_"]').length,
    table: !!table,
    rows: rows.length,
    syllabusLinks: count('a[href*="/auth/katalog/syllabus.pl"]'),
    folderLinks: count('a[href*="../dok_server/slozka.pl"]'),
    // The same signed-in marker the Capacitor transport checks for.
    signedIn: html.includes('logout.pl'),
  };
}
