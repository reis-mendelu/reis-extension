import { describe, it, expect } from 'vitest';
import { parseServerFiles } from '../parser';

/**
 * A real Soubory folder said "1–10 z 24" and reIS parsed 23
 * (`Documents.integrityMismatch`). Not the pagination and not the UIS redesign:
 * page 1 had ten rows and the parser kept nine. The dropped document was named
 * "Přednáška 10, 11 -- Řazení (a vyhledávání)", and the filter meant for IS's
 * own navigation ("Vyhledávání", "Nové dokumenty", …) matched "vyhledávání"
 * anywhere in a name, case-insensitively, so every link on the row was skipped.
 * Those navigation labels live in `table.portal_menu`, which the parser skips
 * anyway; a document name only matches when it IS one of them.
 *
 * Row and header markup copied from that page (dok_server/slozka.pl, read
 * 2026-11-16); ids, the teacher and the token are made up.
 */
const HEADER = `<thead><tr class="zahlavi"><th class="zahlavi" ></th><th class="zahlavi" >Název</th><th class="zahlavi" >Komentář</th><th class="zahlavi" >Vložil</th><th class="zahlavi"  title="DD.MM.RRRR">Datum dokumentu</th><th class="zahlavi"  title="DD.MM.RRRR">Modifikace</th><th class="zahlavi" >Zobrazit</th><th class="zahlavi" >Upravit</th><th class="zahlavi" >Statistika</th><th class="zahlavi" >Přílohy</th><th class="zahlavi" >Změnit přílohu</th></tr></thead>`;

const row = (name: string, dok: number) =>
  `<tr class=" uis-hl-table lbn" ><td class="odsazena" align="center" nowrap="1"><span class="uf-icon xs" role="img" data-sysid="stav-precteno" data-id="2128" aria-label="" alt="" title="" > </span></td><td class="odsazena" align="left">${name}</td><td class="odsazena" align="left"></td><td class="odsazena" nowrap="1" align="left"><a target="_blank" href="/auth/lide/clovek.pl?id=900001;lang=cz">J. Vzorový</a></td><td class="odsazena" nowrap="1" align="left">04.12.2025</td><td class="odsazena" nowrap="1" align="left">11.12.2025</td><td class="odsazena" align="center"><a href="dokumenty_cteni.pl?id=900100;on=0;dok=${dok};serializace=0:0:0:user:0;lang=cz"><span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" data-id="1146" aria-label="Prohlížení informací" alt="Prohlížení informací" title="Prohlížení informací" > </span></a></td><td class="odsazena" align="center" nowrap="1"></td><td class="odsazena" align="center" nowrap="1"></td><td class="odsazena" align="center" nowrap="1"><a href="/auth/dok_server/slozka.pl?download=${dok};id=900100;z=1;lang=cz"><span class="uf-icon sm" role="img" data-sysid="mime-pptx" data-id="0" aria-label="algo10.pptx" alt="algo10.pptx" title="algo10.pptx"  data-mime="pptx"  > </span></a>&nbsp;&nbsp;</td><td class="odsazena" align="center" nowrap="1"></td></tr>`;

const page = (...rows: string[]) =>
  `<html><body><table id="tmtab_1">${HEADER}<tbody>${rows.join('')}</tbody></table></body></html>`;

describe('parseServerFiles — a document whose name contains a navigation word', () => {
  it('keeps "Přednáška 10, 11 -- Řazení (a vyhledávání)"', () => {
    const { files } = parseServerFiles(
      page(
        row('Přednáška 10, 11 -- Řazení (a&nbsp;vyhledávání)', 900201),
        row('Přednáška 8', 900202)
      )
    );
    expect(files).toHaveLength(2);
    expect(files[0]!.files.map((f) => f.link)).toEqual([
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=900201;id=900100;z=1;lang=cz',
    ]);
  });

  it('keeps English names containing "Searching" or "New documents" too', () => {
    const { files } = parseServerFiles(
      page(row('Lecture 4 -- Searching and sorting', 900203), row('New documents policy', 900204))
    );
    expect(files).toHaveLength(2);
  });

  it('still drops a row that is exactly an IS navigation label', () => {
    const { files } = parseServerFiles(
      page(row('Nové dokumenty&nbsp;(436)', 900205), row('Vyhledávání', 900206))
    );
    expect(files).toEqual([]);
  });
});
