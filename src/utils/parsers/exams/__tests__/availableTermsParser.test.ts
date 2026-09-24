import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseExamData } from '../index';

// Minimal table_2 fixture faithful to real IS Mendelu available-terms HTML.
// Columns: Poř. | Kód | Předmět | Datum | Kde | Sekce | Vypsal | Obsazenost | Typ | Přihlašování | Info
function wrapInPage(table2Rows: string): string {
  return `<html><body>
        <table id="table_1"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th>
            <th>Info</th>
        </tr></thead><tbody></tbody></table>
        <table id="table_2"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th>
            <th>Info</th>
        </tr></thead><tbody>${table2Rows}</tbody></table>
    </body></html>`;
}

// Minimal available-term row with standard capacity "5/20".
const ROW_NORMAL_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">15.05.2026 09:00 (pá)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">5/20</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>14.05.2026 23:00<br>14.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999001">Info</a></td>
</tr>`;

// Real-world row (observed 2026-05-06) where IS Mendelu appends waitlist size
// in parentheses: "0/12(8)" means 0 enrolled, 12 capacity, 8 on waitlist.
// This caused a NaN parse error before the fix.
const ROW_WAITLIST_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">15.05.2026 09:00 (pá)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">0/12(8)</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>14.05.2026 23:00<br>14.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999002">Info</a></td>
</tr>`;

// Full with waitlist: "12/12(3)" — should be marked full.
const ROW_FULL_WAITLIST_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">16.05.2026 09:00 (so)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">12/12(3)</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>15.05.2026 23:00<br>15.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999003">Info</a></td>
</tr>`;

// Blocked-with-watchdog row: real-world Operace cell from termin-seznam.html with
// Podrobnosti + Zobrazit důvod + Hlídat termín anchors all present.
// Podrobnosti uses the *relative* href form IS Mendelu actually emits — the page
// lives at /auth/student/, so the browser resolves it there. Anchoring it at the
// IS root would 404.
const ROW_BLOCKED_WITH_BUILTIN_ACTIONS = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBC-MT</td>
    <td>Marketing</td>
    <td nowrap="1">28.04.2026 15:00 (út)</td>
    <td nowrap="1">Studovna PEF (ČP)</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=55555">A. Krejčíř</a></td>
    <td align="center" nowrap="1">5/20</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">11.04.2026 10:00<br>27.04.2026 23:00<br>27.04.2026 23:00</td>
    <td>
        <a href="terminy_info.pl?termin=336593;studium=149707;obdobi=812;lang=cz"><img src="/img.pl?unid=23" alt="Podrobnosti" title="Podrobnosti" sysid="prohlizeni-info"></a>
        <a href="/auth/student/terminy_seznam.pl?termin=336593;studium=149707;obdobi=812;zobraz_duvod=1;lang=cz"><img src="/img.pl?unid=71537" alt="Zobrazit důvod" title="Zobrazit důvod" sysid="studevid-nesplnene-povinnosti"></a>
        <a href="/auth/student/terminy_seznam.pl?termin=336593;studium=149707;obdobi=812;aktivace=1;lang=cz"><img src="/img.pl?unid=13345" alt="Hlídat termín" title="Hlídat termín" sysid="terminy-pes"></a>
    </td>
</tr>`;

// Armed watchdog row: IS Mendelu swaps the icon to a deactivation variant
// (dog with X) and emits aktivace=2 in the href. The icon's sysid may differ
// from "terminy-pes" — the parser must find the watchdog by href, not by sysid.
const ROW_ARMED_WATCHDOG = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBC-IV</td>
    <td>Internet věcí</td>
    <td nowrap="1">02.06.2026 09:00 (út)</td>
    <td nowrap="1">Q17 (ČP)</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=66666">V. Kebo</a></td>
    <td align="center" nowrap="1">15/15</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.06.2026 09:00<br>01.06.2026 09:00<br>01.06.2026 09:00</td>
    <td>
        <a href="terminy_info.pl?termin=339178;studium=149707;obdobi=812;lang=cz"><img src="/img.pl?unid=23" alt="Podrobnosti" title="Podrobnosti" sysid="prohlizeni-info"></a>
        <a href="/auth/student/terminy_seznam.pl?termin=339178;studium=149707;obdobi=812;zobraz_duvod=1;lang=cz"><img src="/img.pl?unid=71537" alt="Zobrazit důvod" title="Zobrazit důvod" sysid="studevid-nesplnene-povinnosti"></a>
        <a href="/auth/student/terminy_seznam.pl?termin=339178;studium=149707;obdobi=812;aktivace=2;lang=cz"><img src="/img.pl?unid=99999" alt="Zrušit hlídače" title="Zrušit hlídače" sysid="terminy-pes-aktivni"></a>
    </td>
</tr>`;

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock('@/utils/reportError', () => ({ reportError }));

describe('availableTermsParser — capacity formats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses standard "occupied/total" capacity', () => {
    const result = parseExamData(wrapInPage(ROW_NORMAL_CAPACITY), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    // safe: length asserted above
    expect(terms[0]!.capacity).toEqual({ occupied: 5, total: 20, raw: '5/20' });
    expect(terms[0]!.full).toBe(false);
  });

  it('parses waitlist capacity "0/12(8)" without error and marks not full', () => {
    const result = parseExamData(wrapInPage(ROW_WAITLIST_CAPACITY), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    // total must be 12, not 0 (the bug: Number('12(8)') === NaN → was clamped to 0)
    // safe: length asserted above
    expect(terms[0]!.capacity).toEqual({ occupied: 0, total: 12, raw: '0/12(8)' });
    expect(terms[0]!.full).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('marks "12/12(3)" as full', () => {
    const result = parseExamData(wrapInPage(ROW_FULL_WAITLIST_CAPACITY), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    // safe: length asserted above
    expect(terms[0]!.capacity).toEqual({ occupied: 12, total: 12, raw: '12/12(3)' });
    expect(terms[0]!.full).toBe(true);
  });
});

describe('availableTermsParser — IS Mendelu built-in action links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts watchdog, block-reason, and detail URLs when IS Mendelu emits them', () => {
    const result = parseExamData(wrapInPage(ROW_BLOCKED_WITH_BUILTIN_ACTIONS), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    const term = terms[0]!; // safe: length asserted above
    expect(term.watchdogUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=336593;studium=149707;obdobi=812;aktivace=1;lang=cz'
    );
    expect(term.blockReasonUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=336593;studium=149707;obdobi=812;zobraz_duvod=1;lang=cz'
    );
    expect(term.detailUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=336593;studium=149707;obdobi=812;lang=cz'
    );
  });

  it('omits URLs when IS Mendelu does not emit the anchors (standard enrollable row)', () => {
    const result = parseExamData(wrapInPage(ROW_NORMAL_CAPACITY), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    // safe: length asserted above
    expect(terms[0]!.watchdogUrl).toBeUndefined();
    expect(terms[0]!.blockReasonUrl).toBeUndefined();
    // detail URL absent on this fixture (no <img sysid="prohlizeni-info"> in the Info cell)
    expect(terms[0]!.detailUrl).toBeUndefined();
  });

  it('captures aktivace=2 deactivation URL on armed terms (icon swaps, sysid may differ)', () => {
    const result = parseExamData(wrapInPage(ROW_ARMED_WATCHDOG), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    // safe: length asserted above
    expect(terms[0]!.watchdogUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=339178;studium=149707;obdobi=812;aktivace=2;lang=cz'
    );
  });
});

// Real table_2 row (IS Mendelu, captured 2026-09-22) in the icon markup IS
// serves now: every icon is a <span class="uf-icon" data-sysid="…"> wrapping an
// inline SVG, where it used to be an <img sysid="…">. The SVGs are dropped and
// the teacher, study and period ids replaced with placeholders; everything else
// is verbatim — including the new leading "Vhodný termín" column.
const modernRow = (typeCell: string) =>
  `<tr class=" uis-hl-table lbn" ><td class="odsazena" align="right">1.</td><td class="odsazena" align="center"><span class="uf-icon xxs" role="img" data-sysid="termin-vhodny" data-id="2544" aria-label="Vhodný termín" alt="Vhodný termín" title="Vhodný termín" >  </span></td><td class="odsazena" align="left">EBC-EKM</td><td class="odsazena" align="left"><a href="/auth/katalog/syllabus.pl?predmet=163979;zpet=/auth/student/terminy_seznam.pl?;lang=cz" target="_blank">Ekonometrie 1</a><span class="uf-icon xs" role="img" data-sysid="hvezda-nesvitici" data-id="2500" style="cursor: pointer;vertical-align: middle;" aria-label="Oblíbený předmět" alt="Oblíbený předmět" title="Oblíbený předmět" >  </span></td><td class="odsazena" align="left" nowrap="1">ZS 2026/2027 - PEF</td><td class="odsazena" align="left" nowrap="1">09.11.2026 10:25 (po)</td><td class="odsazena" align="left" nowrap="1"><a href="/auth/mistnosti/index.pl?zobrazit_mistnost=659;zpet=/auth/student/terminy_seznam.pl?;lang=cz">Studovna PEF (ČP)</a></td><td class="odsazena" align="left" nowrap="1">průběžný test 1<br />(e-test)</td><td class="odsazena" nowrap="nowrap" align="left"><a href="/auth/lide/clovek.pl?id=12345;lang=cz" target="_blank">J. Novák</a></td><td class="odsazena" align="center" nowrap="1">48/66</td><td class="odsazena" align="center" nowrap="1">${typeCell}</td><td class="odsazena" align="center" nowrap="1">21.09.2026 13:00<br />08.11.2026 20:00<br />08.11.2026 20:00</td><td class="odsazena" align="left" nowrap="1"><a href="terminy_info.pl?termin=343994;studium=149707;obdobi=812;lang=cz"><span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" data-id="1146" aria-label="Podrobnosti" alt="Podrobnosti" title="Podrobnosti" >  </span></a></td><td class="odsazena" align="center"><a href="terminy_prihlaseni.pl?termin=343994;studium=149707;obdobi=812;lang=cz"><span class="uf-icon xs" role="img" data-sysid="base-op" data-id="294" aria-label="Přejít do aplikace Přihlášení na termín" alt="Přejít do aplikace Přihlášení na termín" title="Přejít do aplikace Přihlášení na termín" >  </span></a>&nbsp;<a href="terminy_seznam.pl?termin=343994;studium=149707;obdobi=812;prihlasit_ihned=1;lang=cz"><span class="uf-icon xs" role="img" data-sysid="small-arrow-right-double" data-id="445" aria-label="Ihned se přihlásit na termín" alt="Ihned se přihlásit na termín" title="Ihned se přihlásit na termín" >  </span></a></td></tr>`;

const typeIcon = (sysid: string, label: string) =>
  `<span class="uf-icon xs" role="img" data-sysid="${sysid}" data-id="2227" aria-label="${label}" alt="${label}" title="${label}" >  </span>`;

describe('availableTermsParser — the icon markup IS serves now (span[data-sysid])', () => {
  beforeEach(() => vi.clearAllMocks());

  const parseOne = (typeCell: string) => {
    const result = parseExamData(wrapInPage(modernRow(typeCell)), 'cz');
    const terms = result.flatMap((s) => s.sections.flatMap((sec) => sec.terms));
    expect(terms).toHaveLength(1);
    return terms[0]!; // safe: length asserted above
  };

  it('reads the attempt type from a data-sysid icon', () => {
    expect(parseOne(typeIcon('termin-radny', 'řádný')).attemptTypes).toEqual(['regular']);
  });

  it('reads every attempt a term counts as, in order', () => {
    const cell =
      typeIcon('termin-radny', 'řádný') +
      typeIcon('termin-opravny-1', '1. opravný') +
      typeIcon('termin-opravny-2', '2. opravný');
    expect(parseOne(cell).attemptTypes).toEqual(['regular', 'retake1', 'retake2']);
  });

  it('does not read the "Vhodný termín" marker as an attempt', () => {
    expect(parseOne('').attemptTypes).toBeUndefined();
  });

  it('still finds the Podrobnosti link behind a data-sysid icon', () => {
    expect(parseOne(typeIcon('termin-radny', 'řádný')).detailUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343994;studium=149707;obdobi=812;lang=cz'
    );
  });
});

// Real table_3 row ("Kam se přihlásit nemohu?", captured 2026-09-22): the
// terms a student is shown but cannot sign up for. No "Stav" column, so the
// code and name sit one cell further left than in table_2, and no Přihlásit
// cell — only Podrobnosti and "Zobrazit důvod". Teacher and ids replaced.
const BLOCKED_ROW = `<tr class=" uis-hl-table lbn" ><td class="odsazena" align="right">1.</td><td class="odsazena" align="left">EBC-EKM</td><td class="odsazena" align="left"><a href="/auth/katalog/syllabus.pl?predmet=163979;zpet=/auth/student/terminy_seznam.pl?;lang=cz" target="_blank">Ekonometrie 1</a><span class="uf-icon xs" role="img" data-sysid="hvezda-nesvitici" data-id="2500" style="cursor: pointer;vertical-align: middle;" aria-label="Oblíbený předmět" alt="Oblíbený předmět" title="Oblíbený předmět" >  </span></td><td class="odsazena" align="left" nowrap="1">ZS 2026/2027 - PEF</td><td class="odsazena" align="left" nowrap="1">14.12.2026 11:00 (po)</td><td class="odsazena" align="left" nowrap="1"><a href="/auth/mistnosti/index.pl?zobrazit_mistnost=659;zpet=/auth/student/terminy_seznam.pl?;lang=cz">Studovna PEF (ČP)</a></td><td class="odsazena" align="left" nowrap="1">průběžný test 1<br />(e-test)</td><td class="odsazena" nowrap="nowrap" align="left"><a href="/auth/lide/clovek.pl?id=12345;lang=cz" target="_blank">J. Novák</a></td><td class="odsazena" align="center" nowrap="1">0/74</td><td class="odsazena" align="center" nowrap="1"><span class="uf-icon xs" role="img" data-sysid="termin-opravny-1" data-id="2230" aria-label="1. opravný" alt="1. opravný" title="1. opravný" >  </span></td><td class="odsazena" align="center" nowrap="1">09.11.2026 15:00<br />13.12.2026 20:00<br />13.12.2026 20:00</td><td class="odsazena" align="left" nowrap="1"><a href="terminy_info.pl?termin=343998;studium=149707;obdobi=812;lang=cz"><span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" data-id="1146" aria-label="Podrobnosti" alt="Podrobnosti" title="Podrobnosti" >  </span></a><a href="/auth/student/terminy_seznam.pl?termin=343998;studium=149707;obdobi=812;zobraz_duvod=1;lang=cz"><span class="uf-icon sm" role="img" data-sysid="studevid-nesplnene-povinnosti" data-id="2139" aria-label="Zobrazit důvod" alt="Zobrazit důvod" title="Zobrazit důvod" >  </span></a></td></tr>`;

const withBlockedTable = (rows: string) =>
  wrapInPage('').replace(
    '</body>',
    `<table id="table_3"><thead><tr class="zahlavi"><th>Poř.</th><th>Kód</th><th>Předmět</th><th>Období</th><th>Datum termínu</th><th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th><th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th><th>Operace</th></tr></thead><tbody>${rows}</tbody></table></body>`
  );

describe('availableTermsParser — terms the student cannot sign up for (table_3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists them, under the right subject and section, marked as not registrable', () => {
    const result = parseExamData(withBlockedTable(BLOCKED_ROW), 'cz');
    expect(result).toHaveLength(1);
    const subject = result[0]!; // safe: length asserted above
    expect(subject.code).toBe('EBC-EKM');
    expect(subject.name).toBe('Ekonometrie 1');
    const section = subject.sections[0]!;
    expect(section.name).toBe('Průběžný test 1');
    const term = section.terms[0]!;
    expect(term.id).toBe('343998');
    expect(term.date).toBe('14.12.2026');
    expect(term.cannotRegister).toBe(true);
    expect(term.canRegisterNow).toBe(false);
    expect(term.attemptTypes).toEqual(['retake1']);
    expect(term.registrationEnd).toBe('13.12.2026 20:00');
    expect(term.blockReasonUrl).toBe(
      'https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=343998;studium=149707;obdobi=812;zobraz_duvod=1;lang=cz'
    );
  });

  it('does not mark the terms of table_2 as blocked', () => {
    const result = parseExamData(wrapInPage(modernRow(typeIcon('termin-radny', 'řádný'))), 'cz');
    expect(result[0]!.sections[0]!.terms[0]!.cannotRegister).toBeUndefined();
  });
});
