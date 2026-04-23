import { describe, it, expect } from 'vitest';
import { parseExamData } from '../index';

// Minimal but structurally faithful wrappers around real IS Mendelu rows from
// reis-scraper/termin-seznam.html (captured 2026-04-23, studium=149707).
// table_1 = registered terms, table_3 = available terms (empty here).

function wrapInPage(table1Rows: string): string {
    return `<html><body>
        <table id="table_1"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>Přihlašování do<br>Odhlašování do</th>
            <th>Info</th><th>Odhlásit</th>
        </tr></thead><tbody>${table1Rows}</tbody></table>
        <table id="table_3"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>Přihlašování do<br>Odhlašování do</th>
            <th>Info</th>
        </tr></thead><tbody></tbody></table>
    </body></html>`;
}

// Real row for EBC-MT (Matematika, termin=336592) — deadline NOT yet passed.
// Both odhlasit_ihned and terminy_info links present.
const MATEMATIKA_ROW_ACTIVE = `
<tr class=" uis-hl-table lbn">
    <td class="odsazena" align="right">1.</td>
    <td class="odsazena" align="left">EBC-MT</td>
    <td class="odsazena" align="left"><a href="/auth/katalog/syllabus.pl?predmet=162572" target="_blank">Matematika</a></td>
    <td class="odsazena" align="left" nowrap="1">23.04.2026 11:00 (čt)</td>
    <td class="odsazena" align="left" nowrap="1"><a href="/auth/mistnosti/index.pl?zobrazit_mistnost=659">Studovna PEF (ČP)</a></td>
    <td class="odsazena" align="left" nowrap="1">zápočet - průběžný<br>(e-test)</td>
    <td class="odsazena" nowrap="nowrap" align="left"><a href="/auth/lide/clovek.pl?id=26902" target="_blank">D. Říhová</a></td>
    <td class="odsazena" align="center" nowrap="1">54/70</td>
    <td class="odsazena" align="center" nowrap="1"><img src="/img.pl?unid=71631" alt="řádný" title="řádný"></td>
    <td class="odsazena" align="center" nowrap="1">11.04.2026 10:00<br>22.04.2026 23:00<br>22.04.2026 23:00</td>
    <td class="odsazena" align="center"><a href="terminy_info.pl?termin=336592;studium=149707;obdobi=812;lang=cz"><img alt="Podrobnosti"></a></td>
    <td class="odsazena" align="center">
        <a href="terminy_prihlaseni.pl?termin=336592;studium=149707;obdobi=812;lang=cz"><img alt="Odhlášení"></a>
        <a href="terminy_seznam.pl?termin=336592;studium=149707;obdobi=812;odhlasit_ihned=1;lang=cz"><img alt="Ihned se odhlásit"></a>
    </td>
</tr>`;

// Same row after deregistration deadline — IS Mendelu removes the odhlasit_ihned link.
// terminy_info ("Podrobnosti") link remains.
const MATEMATIKA_ROW_PAST_DEADLINE = `
<tr class=" uis-hl-table lbn">
    <td class="odsazena" align="right">1.</td>
    <td class="odsazena" align="left">EBC-MT</td>
    <td class="odsazena" align="left"><a href="/auth/katalog/syllabus.pl?predmet=162572" target="_blank">Matematika</a></td>
    <td class="odsazena" align="left" nowrap="1">23.04.2026 11:00 (čt)</td>
    <td class="odsazena" align="left" nowrap="1"><a href="/auth/mistnosti/index.pl?zobrazit_mistnost=659">Studovna PEF (ČP)</a></td>
    <td class="odsazena" align="left" nowrap="1">zápočet - průběžný<br>(e-test)</td>
    <td class="odsazena" nowrap="nowrap" align="left"><a href="/auth/lide/clovek.pl?id=26902" target="_blank">D. Říhová</a></td>
    <td class="odsazena" align="center" nowrap="1">54/70</td>
    <td class="odsazena" align="center" nowrap="1"><img src="/img.pl?unid=71631" alt="řádný" title="řádný"></td>
    <td class="odsazena" align="center" nowrap="1">11.04.2026 10:00<br>22.04.2026 23:00<br>22.04.2026 23:00</td>
    <td class="odsazena" align="center"><a href="terminy_info.pl?termin=336592;studium=149707;obdobi=812;lang=cz"><img alt="Podrobnosti"></a></td>
    <td class="odsazena" align="center"></td>
</tr>`;

describe('registeredTermsParser', () => {
    it('extracts termId from odhlasit_ihned link when deadline is in the future', () => {
        const subjects = parseExamData(wrapInPage(MATEMATIKA_ROW_ACTIVE), 'cz');
        const term = subjects[0]?.sections[0]?.registeredTerm;
        expect(term?.id).toBe('336592');
    });

    it('extracts termId from terminy_info link when odhlasit_ihned is absent (past deadline)', () => {
        const subjects = parseExamData(wrapInPage(MATEMATIKA_ROW_PAST_DEADLINE), 'cz');
        const term = subjects[0]?.sections[0]?.registeredTerm;
        expect(term?.id).toBe('336592');
    });

    it('parses date, time and room correctly', () => {
        const subjects = parseExamData(wrapInPage(MATEMATIKA_ROW_ACTIVE), 'cz');
        const term = subjects[0]?.sections[0]?.registeredTerm;
        expect(term?.date).toBe('23.04.2026');
        expect(term?.time).toBe('11:00');
        expect(term?.room).toBe('Studovna PEF (ČP)');
    });
});
