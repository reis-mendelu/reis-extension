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
