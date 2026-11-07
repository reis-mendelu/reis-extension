import { describe, it, expect } from 'vitest';
import { parseServerFiles } from '../parser';
import { collapseAttachments } from '../collapseAttachments';

/**
 * One IS document can carry several files, and IS names each of them.
 *
 * Shape captured live from is.mendelu.cz on 2026-11-07 (slozka.pl folder pages
 * of four subjects, cz and en). Every link in the Přílohy cell wraps a mime icon
 * whose `title` and `aria-label` are that file's own name, extension included:
 * a lecture row read "ig-03 + ig-04 + ig-05" and held five PDFs named
 * ig-03-…pdf, eth_frame.pdf, ig-04-…pdf, ig-05-…pdf and labbook_….pdf. reIS
 * called all five by the row title plus "(1)"…"(5)", and the phone's truncation
 * cut the suffix, so the rows looked identical. Over one student's 8 subjects
 * that was 52 of 102 files.
 *
 * Names, ids and people below are made up; the markup is IS's.
 */
const header = (modified: string) => `
  <thead><tr class="zahlavi">
    <th class="zahlavi"></th><th class="zahlavi">Název</th><th class="zahlavi">Komentář</th>
    <th class="zahlavi">Vložil</th><th class="zahlavi">Datum dokumentu</th>
    <th class="zahlavi">${modified}</th><th class="zahlavi">Zobrazit</th>
    <th class="zahlavi">Upravit</th><th class="zahlavi">Statistika</th>
    <th class="zahlavi">Přílohy</th><th class="zahlavi">Změnit přílohu</th>
  </tr></thead>`;

const icon = (mime: string, filename: string) =>
  `<span class="uf-icon sm" role="img" data-sysid="${mime}" data-id="0" aria-label="${filename}" alt="${filename}" title="${filename}" data-mime="${mime.replace('mime-', '')}"><svg></svg></span>`;

const row = (title: string, date: string, modified: string) => `
  <tr class=" uis-hl-table lbn">
    <td class="odsazena"><span class="uf-icon xs" role="img" data-sysid="stav-neprecteno" aria-label="" title=""></span></td>
    <td class="odsazena" align="left">${title}</td>
    <td class="odsazena" align="left"></td>
    <td class="odsazena"><a href="/auth/lide/clovek.pl?id=4242;lang=cz" target="_blank">J. Novák</a></td>
    <td class="odsazena">${date}</td>
    <td class="odsazena">${modified}</td>
    <td class="odsazena"><a href="dokumenty_cteni.pl?id=500;on=0;dok=900001;serializace=1:2:3;lang=cz"><span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" title="Prohlížení informací"></span></a></td>
    <td class="odsazena"></td><td class="odsazena"></td>
    <td class="odsazena">
      <a href="/auth/dok_server/slozka.pl?download=900001;id=500;z=1;lang=cz">${icon('mime-pdf', 'harmonogram_prez.pdf')}</a>&nbsp;&nbsp;
      <a href="/auth/dok_server/slozka.pl?download=70001;id=500;z=1;pril=1;lang=cz">${icon('mime-pdf', 'org-info_ZS.pdf')}</a>&nbsp;&nbsp;
      <a href="/auth/dok_server/slozka.pl?download=70002;id=500;z=1;pril=1;lang=cz">${icon('mime-unknown', 'uloha-01.ipynb')}</a>&nbsp;&nbsp;
    </td>
    <td class="odsazena"></td>
  </tr>`;

const page = (modifiedHeader: string, title: string, date: string, modified: string) =>
  `<table id="tmtab_1">${header(modifiedHeader)}<tbody>${row(title, date, modified)}</tbody></table>`;

describe('parseServerFiles — each attachment keeps its own name', () => {
  const { files } = parseServerFiles(
    page('Modifikace', 'Harmonogram+info: 2.–6. 11. (prezenční)', '17.09.2026', '23.10.2026')
  );
  const doc = files[0]!;
  const attachments = collapseAttachments(doc.files);

  it('reads every file name from its mime icon', () => {
    expect(attachments.map((a) => a.filename)).toEqual([
      'harmonogram_prez.pdf',
      'org-info_ZS.pdf',
      'uloha-01.ipynb',
    ]);
  });

  it("types a file IS calls 'unknown' by its extension", () => {
    expect(attachments.map((a) => a.type)).toEqual(['pdf', 'pdf', 'ipynb']);
  });

  it('keeps the title as IS prints it for display, and file_name path-safe', () => {
    expect(doc.title).toBe('Harmonogram+info: 2.–6. 11. (prezenční)');
    // Unchanged: file_name is what saved files and dedup keys have always used.
    expect(doc.file_name).toBe('Harmonograminfo 2.6. 11. prezenční');
  });

  it('reads the Modifikace date beside the document date', () => {
    expect(doc.date).toBe('17.09.2026');
    expect(doc.modified).toBe('23.10.2026');
  });

  it('reads the English page too, whose column is "Modifications"', () => {
    const en = parseServerFiles(page('Modifications', 'Schedule', '09/17/2026', '10/23/2026'));
    expect(en.files[0]?.date).toBe('09/17/2026');
    expect(en.files[0]?.modified).toBe('10/23/2026');
  });

  it('leaves modified out when the table has no such column', () => {
    const html = `<table id="tmtab_1"><thead><tr class="zahlavi"><th></th><th>Název</th><th>Komentář</th><th>Vložil</th><th>Datum dokumentu</th><th>Přílohy</th></tr></thead><tbody>
      <tr class="uis-hl-table lbn"><td></td><td>Sylabus</td><td></td><td>J. Novák</td><td>01.09.2026</td>
      <td><a href="/auth/dok_server/slozka.pl?download=1;id=2;z=1;lang=cz">${icon('mime-pdf', 's.pdf')}</a></td></tr></tbody></table>`;
    const parsed = parseServerFiles(html).files[0]!;
    expect(parsed.date).toBe('01.09.2026');
    expect(parsed.modified).toBeUndefined();
  });
});

describe('collapseAttachments — keeps the file name through the merge', () => {
  it('takes the name from whichever of the pair carries it', () => {
    const merged = collapseAttachments([
      { name: 'D', type: 'unknown', link: 'https://is.mendelu.cz/x/dokumenty_cteni.pl?dok=5' },
      {
        name: 'D',
        type: 'pdf',
        link: 'https://is.mendelu.cz/x/slozka.pl?download=5',
        filename: 'real.pdf',
      },
    ]);
    expect(merged).toEqual([
      {
        name: 'D',
        type: 'pdf',
        link: 'https://is.mendelu.cz/x/slozka.pl?download=5',
        filename: 'real.pdf',
      },
    ]);
    const reversed = collapseAttachments([
      { name: 'D', type: 'pdf', link: 'https://is.mendelu.cz/x/slozka.pl?download=6' },
      {
        name: 'D',
        type: 'unknown',
        link: 'https://is.mendelu.cz/x/dokumenty_cteni.pl?dok=6',
        filename: 'other.pdf',
      },
    ]);
    expect(reversed[0]?.filename).toBe('other.pdf');
  });
});
