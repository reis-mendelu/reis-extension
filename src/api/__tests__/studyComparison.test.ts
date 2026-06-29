import { describe, it, expect } from 'vitest';
import { percentileStanding } from '../studyComparison';

describe('percentileStanding', () => {
  // IS reports "Percentil" = rank/total*100 (lower is better). The summary
  // sentence pivots at the 50th percentile: top half is framed as "top X%",
  // bottom half as "you beat (100-X)%".
  it('frames the top half as "top X%" (percentile <= 50)', () => {
    expect(percentileStanding(6.19)).toEqual({ tier: 'top', pct: 6.19 });
  });

  it('frames the bottom half as the share you beat (percentile > 50)', () => {
    // 55.58 -> 100 - 55.58 = 44.42 (matches IS "44,42 % studentů")
    expect(percentileStanding(55.58)).toEqual({ tier: 'bottom', pct: 44.42 });
  });

  it('treats exactly the 50th percentile as top half', () => {
    expect(percentileStanding(50)).toEqual({ tier: 'top', pct: 50 });
  });

  it('rounds the beaten share to 2 decimals (no float dust)', () => {
    expect(percentileStanding(66.67)).toEqual({ tier: 'bottom', pct: 33.33 });
  });
});

import { parseStudyComparison } from '../studyComparison';

// Real markup from pruchod_studiem.pl?vyber=zobrazeni_percentilu (LS 2025/26, PEF).
// All three modes ship in one page as #perc_3 / #perc_4 / #perc_5; Mode 3
// (faculty + study type + year) is #perc_5. perc_3 is included so the test
// proves the parser targets Mode 3, not just the first table on the page.
const PERCENTILE_HTML = `
<div class="perc_divy" id="perc_3"><b>Percentil počítaný přes fakultu a ročníky</b>
<table><tbody><tr><td class="odsazena" align="left">Fakulta: </td><td class="odsazena" align="left">Provozně ekonomická fakulta</td></tr><tr><td class="odsazena" align="left">Ročník: </td><td class="odsazena" align="left">2</td></tr></tbody></table>
<table><thead><tr class="zahlavi"><th class="zahlavi">Pořadí</th><th class="zahlavi">Percentil</th><th class="zahlavi">Průměr</th><th class="zahlavi">Nejbližší lepší průměr</th></tr></thead><tbody><tr class=" lbn"><td class="odsazena" align="center">75./960</td><td class="odsazena" align="center">7,81</td><td class="odsazena" align="center">1,53</td><td class="odsazena" align="center">1,52</td></tr></tbody></table>
Patří mezi 7,81 % nejlepších studentů podle dosaženého studijního průměru.</div>
<div class="perc_divy" id="perc_5"><b>Percentil počítaný přes fakultu, typ studia a ročníky</b>
<table><tbody><tr><td class="odsazena" align="left">Fakulta: </td><td class="odsazena" align="left">Provozně ekonomická fakulta</td></tr><tr><td class="odsazena" align="left">Typ studia: </td><td class="odsazena" align="left">Bakalářský</td></tr><tr><td class="odsazena" align="left">Ročník: </td><td class="odsazena" align="left">2</td></tr></tbody></table>
<table><thead><tr class="zahlavi"><th class="zahlavi">Pořadí</th><th class="zahlavi">Percentil</th><th class="zahlavi">Průměr</th><th class="zahlavi">Nejbližší lepší průměr</th></tr></thead><tbody><tr class=" lbn"><td class="odsazena" align="center">34./549</td><td class="odsazena" align="center">6,19</td><td class="odsazena" align="center">1,53</td><td class="odsazena" align="center">1,51</td></tr></tbody></table>
Patří mezi 6,19 % nejlepších studentů podle dosaženého studijního průměru.</div>`;

function parse(html: string) {
  const doc = new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html');
  return parseStudyComparison(doc);
}

describe('parseStudyComparison', () => {
  it('reads Mode 3 (#perc_5: faculty + study type + year), not the first table', () => {
    const result = parse(PERCENTILE_HTML);
    expect(result).toEqual({ rank: 34, total: 549, percentile: 6.19, gpa: 1.53, nextBetterGpa: 1.51 });
  });

  it('returns null when the Mode 3 block is absent', () => {
    const result = parse('<div class="perc_divy" id="perc_3"></div>');
    expect(result).toBeNull();
  });
});
