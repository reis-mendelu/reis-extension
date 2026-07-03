import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real row from the live e-index "Podrobný přehled za celé studium"
// (pruchod_studiem.pl?vyber=podrobne_vsechna_obdobi). 11 columns, no leading
// "Poř" cell — header order: Kód | Předmět | Povinnost | Jaz | Uk | Pokus |
// Výsledek | Zadáno | Zadal | Kredity | Způsob.
const REAL_ROW_HTML = `
<html><body>
<b>LS 2025/2026 - PEF:</b>
<table id="tmtab_1"><thead><tr class="zahlavi"><th>Kód</th><th>Předmět</th><th>Povinnost</th><th>Jaz.</th><th align="center">Uk.</th><th>Pokus</th><th align="center">Výsledek</th><th align="center">Zadáno</th><th align="left">Zadal</th><th>Kredity</th><th align="center">Způsob</th></tr></thead>
  <tbody>
    <tr class="">
      <td class="odsazena" align="left">EBC-BA</td>
      <td class="odsazena" nowrap="1" align="left">
        <a href="/auth/katalog/syllabus.pl?predmet=162547;lang=cz">Bankovnictví 1</a>
      </td>
      <td class="odsazena" align="center"><img alt="povinný" sysid="predmet-povinny"></td>
      <td class="odsazena" align="center">cz</td>
      <td class="odsazena" align="center">zk</td>
      <td class="odsazena" align="center">
        <a href="/auth/student/pruchod_studiem.pl?predmet=162547;lang=cz">1</a>
      </td>
      <td class="odsazena" align="left">
        <div class="flex-container">
          <img sysid="vysledek-uspesny">&nbsp;výborně (A)
        </div>
      </td>
      <td class="odsazena" nowrap="1" align="left">01.06.2026</td>
      <td class="odsazena" align="left" nowrap="1">
        <a href="/auth/lide/clovek.pl?id=45659;lang=cz">Z. Vlasáková</a>
      </td>
      <td class="odsazena" align="center" nowrap="1">4</td>
      <td class="odsazena" align="center"><img sysid="vyuka-normalni"></td>
    </tr>
  </tbody>
</table>
</body></html>
`;

vi.mock('./client', () => ({
    BASE_URL: 'https://is.mendelu.cz',
    fetchWithAuth: vi.fn(async () => ({ text: async () => REAL_ROW_HTML })),
}));

describe('parseGradeHistory column mapping (podrobne_vsechna_obdobi, 11 cols)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps code, examType, attempt, grade letter, and credits to the right columns', async () => {
        const { fetchGradeHistory } = await import('./gradeHistory');
        const result = await fetchGradeHistory('143752', '812');

        expect(result).not.toBeNull();
        expect(result!.grades).toHaveLength(1);

        const g = result!.grades[0];
        expect(g.courseCode).toBe('EBC-BA');      // cells[0]
        expect(g.courseName).toBe('Bankovnictví 1');
        expect(g.examType).toBe('zk');            // cells[4]
        expect(g.attempt).toBe(1);                // cells[5]
        expect(g.gradeLetter).toBe('A');
        expect(g.credits).toBe(4);                // cells[9]
        expect(g.period).toBe('LS 2025/2026 - PEF');
    });
});
