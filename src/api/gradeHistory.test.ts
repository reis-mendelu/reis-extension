import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real row from reis-scraper/pruchod-studiem-detailed.html (EBC-ALG, 2025/2026 ZS).
// Column header order: Poř | Kód | Předmět | Povinnost | Jaz | Uk | Pokus |
// Výsledek | Zadáno | Zadal | Kredity | Způsob (12 columns).
const REAL_ROW_HTML = `
<html><body>
<b>ZS 2025/2026 - PEF:</b>
<table>
  <tbody>
    <tr>
      <td class="UISTMNumberCell UISTMNumberCellHidden"><small></small></td>
      <td class="odsazena" align="left">EBC-ALG</td>
      <td class="odsazena" nowrap="1" align="left">
        <a href="/auth/katalog/syllabus.pl?predmet=159410;lang=cz">Algoritmizace</a>
      </td>
      <td class="odsazena" align="center"><img alt="povinný" sysid="predmet-povinny"></td>
      <td class="odsazena" align="center">cz</td>
      <td class="odsazena" align="center">zk</td>
      <td class="odsazena" align="center">
        <a href="/auth/student/pruchod_studiem.pl?predmet=159410;lang=cz">1</a>
      </td>
      <td class="odsazena" align="left">
        <div class="flex-container">
          <img sysid="vysledek-uspesny">&nbsp;dobře plus (D)
        </div>
      </td>
      <td class="odsazena" nowrap="1" align="left">05.01.2026</td>
      <td class="odsazena" align="left" nowrap="1">
        <a href="/auth/lide/clovek.pl?id=1728;lang=cz">J. Rybička</a>
      </td>
      <td class="odsazena" align="center" nowrap="1">6</td>
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

describe('parseGradeHistory column mapping', () => {
    beforeEach(() => vi.clearAllMocks());

    it('maps examType, attempt, grade letter, and credits to the right columns', async () => {
        const { fetchGradeHistory } = await import('./gradeHistory');
        const result = await fetchGradeHistory('149707', '812');

        expect(result).not.toBeNull();
        expect(result!.grades).toHaveLength(1);

        const g = result!.grades[0];
        expect(g.courseCode).toBe('EBC-ALG');
        expect(g.courseName).toBe('Algoritmizace');
        expect(g.examType).toBe('zk');           // cells[5] — was wrongly cells[4] (lang)
        expect(g.attempt).toBe(1);                // cells[6] — was wrongly cells[5] (examType)
        expect(g.gradeLetter).toBe('D');
        expect(g.credits).toBe(6);                // cells[10] — was wrongly cells[7] (grade text)
        expect(g.period).toBe('ZS 2025/2026 - PEF');
    });
});
