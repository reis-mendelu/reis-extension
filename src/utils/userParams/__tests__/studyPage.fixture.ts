/**
 * `studium.pl` for a student with MORE THAN ONE study, built by hand.
 *
 * The markup is copied from two real pages (October 2026), with every value
 * made up: a student whose PEF study is current while an older FRRMS study is
 * interrupted, and a student with a full-time and a part-time PEF study at
 * once. Only the shape is real — the `<select name="studium">` in `#titulek`
 * (no `<b>` for the study, the selected study listed first), the
 * `studium=…;obdobi=…` links, and the "Stav studia" row.
 *
 * REAL status text, seen on the page: `řádně zapsán` (CZ) and `enrolled` (EN),
 * both on an active study. Every other status here is SYNTHETIC — no page of
 * an interrupted or finished study has been seen yet — and is marked so where
 * it is used.
 */
export interface FixtureStudy {
  studium: string;
  obdobi: string;
  label: string;
}

export const MULTI_CZ = {
  idLabel: 'Identifikační číslo uživatele:',
  statusLabel: 'Stav studia:',
  greeting: 'Přihlášena:',
};
export const MULTI_EN = {
  idLabel: "User's identification number:",
  statusLabel: 'Progress of study:',
  greeting: 'Logged in:',
};

const row = (label: string, value: string) =>
  `<tr class="" ><td class="odsazena" align="left">${label}</td><td class="odsazena" align="left">${value}</td></tr>`;

export function studyPage(opts: {
  studies: FixtureStudy[];
  /** The study the page is about — listed first, `selected`, its links carry it. */
  selected: string;
  status: string;
  lang?: typeof MULTI_CZ;
  studentId?: string;
  name?: string;
  /** A bare word on the page body, e.g. "Erasmus+" for an exchange study. */
  extra?: string;
}): string {
  const lang = opts.lang ?? MULTI_CZ;
  const sel = opts.studies.find((s) => s.studium === opts.selected)!;
  const ordered = [sel, ...opts.studies.filter((s) => s !== sel)];
  const options = ordered
    .map(
      (s) =>
        `<option value="${s.studium}"${s === sel ? ' selected="selected"' : ''}>${s.label}</option>`
    )
    .join('');
  const q = `studium=${sel.studium};obdobi=${sel.obdobi}`;
  return `<html><body>
<div id="horni-navigace"><table border="0"><tr><td id="prihlasen">
               ${lang.greeting}&nbsp;${opts.name ?? 'Jana Nováková'}&nbsp;&nbsp;&nbsp;&nbsp;<a href="/auth/system/zmena_identity.pl" title="x">x</a>
</td></tr></table></div>
<div id="titulek"><h1>Portál studenta</h1><div style="font-size: 11px;"><input type="hidden" name="obdobi" value="${sel.obdobi}" />Studium <select name="studium" >${options}</select> období - <b>všechna období</b>&nbsp;<input type="submit" name="omezit_popupy" value="Vybrat"/></div><hr class="uisseparator" /></div>
<table class="portal_menu"><tbody ><tr class="" >
<td class="odsazena" align="left"><a href="/auth/student/moje_studium.pl" title="Portál studenta">Moje studium</a></td>
<td class="odsazena" align="left"><a href="/auth/student/pruchod_studiem.pl?${q}" title="E-index">E-index</a></td>
<td class="odsazena" align="left"><b><a href="/auth/student/studium.pl?${q}" title="Informace">Informace o&nbsp;mém studiu</a></b></td>
</tr></tbody></table>
<table><tbody >
${row(lang.idLabel, opts.studentId ?? '100001')}
${row('Program:', opts.extra ?? 'Ekonomika a management')}
${row(lang.statusLabel, opts.status)}
${row('Ukončení:', 'neuvedeno')}
</tbody></table>
</body></html>`;
}

/** The interrupted-study student: current PEF study first, as IS lists it. */
export const INTERRUPTED: FixtureStudy[] = [
  { studium: '900001', obdobi: '829', label: 'PEF B-EM prez [sem 1, roč 1]' },
  { studium: '900002', obdobi: '801', label: 'AF B-ZIN-SBABY prez [sem 1, roč 1]' },
  { studium: '900003', obdobi: '815', label: 'FRRMS B-RER prez [sem 3, roč 2]' },
];

/** The concurrent-study student: two PEF studies, both active. */
export const CONCURRENT: FixtureStudy[] = [
  { studium: '900011', obdobi: '829', label: 'PEF B-AII prez [sem 1, roč 1]' },
  { studium: '900012', obdobi: '829', label: 'PEF B-EM komb [sem 1, roč 1]' },
];
