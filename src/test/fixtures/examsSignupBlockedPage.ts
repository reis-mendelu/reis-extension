/**
 * Report #37 (iOS 18, reIS 5.6.0): the student's "Kam se přihlásit nemohu?"
 * table held a "zápis na cvičení" row — an excursion to ZOO Vyškov, 46/46,
 * Typ termínu Ř + 1 — and reIS showed nothing for it.
 *
 * The row is a clone of the real table_3 row captured 2026-09-22 (see
 * `availableTermsParser.test.ts`, BLOCKED_ROW), with only the cell values
 * changed to the ones in her screenshot. Ids and the teacher are made up; the
 * thead is the real one.
 */
const ROW = `<tr class=" uis-hl-table lbn" ><td class="odsazena" align="right">1.</td><td class="odsazena" align="left">ETWHZ</td><td class="odsazena" align="left"><a href="/auth/katalog/syllabus.pl?predmet=100001;zpet=/auth/student/terminy_seznam.pl?;lang=cz" target="_blank">Etologie a welfare hospodářských zvířat</a><span class="uf-icon xs" role="img" data-sysid="hvezda-nesvitici" data-id="2500" style="cursor: pointer;vertical-align: middle;" aria-label="Oblíbený předmět" alt="Oblíbený předmět" title="Oblíbený předmět" >  </span></td><td class="odsazena" align="left" nowrap="1">ZS 2026/2027 - AF</td><td class="odsazena" align="left" nowrap="1">13.11.2026 10:00 (pá)</td><td class="odsazena" align="left" nowrap="1">ZOO Vyškov</td><td class="odsazena" align="left" nowrap="1">zápis na cvičení</td><td class="odsazena" nowrap="nowrap" align="left"><a href="/auth/lide/clovek.pl?id=12345;lang=cz" target="_blank">J. Novák</a></td><td class="odsazena" align="center" nowrap="1">46/46</td><td class="odsazena" align="center" nowrap="1"><span class="uf-icon xs" role="img" data-sysid="termin-radny" data-id="2229" aria-label="řádný" alt="řádný" title="řádný" >  </span><span class="uf-icon xs" role="img" data-sysid="termin-opravny-1" data-id="2230" aria-label="1. opravný" alt="1. opravný" title="1. opravný" >  </span></td><td class="odsazena" align="center" nowrap="1">30.10.2026 13:00<br />12.11.2026 09:00<br />12.11.2026 09:00</td><td class="odsazena" align="left" nowrap="1"><a href="terminy_info.pl?termin=900001;studium=100001;obdobi=800;lang=cz"><span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" data-id="1146" aria-label="Podrobnosti" alt="Podrobnosti" title="Podrobnosti" >  </span></a><a href="/auth/student/terminy_seznam.pl?termin=900001;studium=100001;obdobi=800;zobraz_duvod=1;lang=cz"><span class="uf-icon sm" role="img" data-sysid="studevid-nesplnene-povinnosti" data-id="2139" aria-label="Zobrazit důvod" alt="Zobrazit důvod" title="Zobrazit důvod" >  </span></a></td></tr>`;

const THEAD = `<thead><tr class="zahlavi"><th>Poř.</th><th>Kód</th><th>Předmět</th><th>Období</th><th>Datum termínu</th><th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th><th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th><th>Operace</th></tr></thead>`;

/** A whole terminy_seznam.pl page whose only term is her blocked signup row. */
export const SIGNUP_BLOCKED_PAGE = `<html><body><table id="table_1">${THEAD}<tbody></tbody></table><table id="table_2">${THEAD}<tbody></tbody></table><table id="table_3">${THEAD}<tbody>${ROW}</tbody></table></body></html>`;

/** "Now" for screens rendering it: a week before the excursion. */
export const SIGNUP_BLOCKED_NOW = new Date(2026, 10, 7, 12, 0);
