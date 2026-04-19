
import { describe, it, expect } from 'vitest';
import { parseAssessmentTable } from '../assessmentParser';

describe('assessmentParser', () => {
    // Full HTML for EBC-TZI provided by user (12 rows)
    const REAL_HTML = `
    <table id="tmtab_1">
        <thead>
            <tr class="zahlavi">
                <th class="zahlavi">Poř.</th>
                <th class="zahlavi">Název testu</th>
                <th class="zahlavi">Dosaženo bodů</th>
                <th class="zahlavi">Max. bodů</th>
                <th class="zahlavi">Způsob interpretace</th>
                <th class="zahlavi">Úspěšnost</th>
                <th class="zahlavi">Odevzdáno</th>
                <th class="zahlavi">Správce</th>
                <th class="zahlavi">Podrobnosti</th>
            </tr>
        </thead>
        <tbody>
            <tr class=" uis-hl-table lbn"><td>1</td><td>Vstupní test – opakování ze SŠ</td><td>6,00 </td><td>10</td><td>z</td><td>60,00 %</td><td>22. 09. 2025 11:24</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>2</td><td>Minitestík 01: Výroková logika I</td><td>0,50 </td><td>1</td><td>z</td><td>50,00 %</td><td>30. 09. 2025 13:10</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>3</td><td>Minitestík 02: Výroková logika II</td><td>1,00 </td><td>1</td><td>z</td><td>100,00 %</td><td>07. 10. 2025 13:08</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>4</td><td>Minitestík 03: Výroková logika III</td><td>1,00 </td><td>2</td><td>z</td><td>50,00 %</td><td>14. 10. 2025 14:32</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>5</td><td>Minitestík 04: Predikátová logika</td><td>2,00 </td><td>2</td><td>z</td><td>100,00 %</td><td>21. 10. 2025 13:08</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>6</td><td>Minitestík 05: Množiny</td><td>2,00 </td><td>2</td><td>z</td><td>100,00 %</td><td>04. 11. 2025 13:08</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>7</td><td>Průběžný test 1A</td><td>22,75 </td><td>30</td><td>z</td><td>75,83 %</td><td>06. 11. 2025 16:41</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>8</td><td>Minitestík 06: Relace</td><td>1,50 </td><td>2</td><td>z</td><td>75,00 %</td><td>11. 11. 2025 13:10</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>9</td><td>Minitestík 07: Zobrazení</td><td>1,00 </td><td>2</td><td>z</td><td>50,00 %</td><td>18. 11. 2025 13:08</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>10</td><td>Minitestík 08: Operace</td><td>1,00 </td><td>1</td><td>z</td><td>100,00 %</td><td>25. 11. 2025 13:07</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>11</td><td>Minitestík 09: Grafy</td><td>1,50 </td><td>2</td><td>z</td><td>75,00 %</td><td>02. 12. 2025 13:07</td><td>P. Haluza</td><td></td></tr>
            <tr class=" uis-hl-table lbn"><td>12</td><td>Průběžný test 2A</td><td>15,50 </td><td>30</td><td>z</td><td>51,67 %</td><td>18. 12. 2025 16:22</td><td>P. Haluza</td><td></td></tr>
        </tbody>
    </table>
    `;

    it('should parse real IS Mendelu table structure correctly', () => {
        const results = parseAssessmentTable(REAL_HTML);

        expect(results).toHaveLength(12);

        // Check Row 1: Vstupní test
        expect(results[0]).toEqual({
            name: 'Vstupní test – opakování ze SŠ',
            score: 6.0,
            maxScore: 10.0,
            successRate: 60.0,
            submittedDate: '22. 09. 2025 11:24',
            teacher: 'P. Haluza',
            detailUrl: undefined
        });

        // Check Row 7: Průběžný test 1A (Decimal handling)
        expect(results[6]).toEqual({
            name: 'Průběžný test 1A',
            score: 22.75,
            maxScore: 30.0,
            successRate: 75.83,
            submittedDate: '06. 11. 2025 16:41',
            teacher: 'P. Haluza',
            detailUrl: undefined
        });

         // Check Row 12: Průběžný test 2A
         expect(results[11]).toEqual({
            name: 'Průběžný test 2A',
            score: 15.5,
            maxScore: 30.0,
            successRate: 51.67,
            submittedDate: '18. 12. 2025 16:22',
            teacher: 'P. Haluza',
            detailUrl: undefined
        });
    });

    it('should handle empty HTML gracefully', () => {
        const results = parseAssessmentTable('<div>No table here</div>');
        expect(results).toEqual([]);
    });

    it('should handle table without correct ID gracefully', () => {
        const results = parseAssessmentTable('<table id="wrong_id"><tr><td>Test</td></tr></table>');
        expect(results).toEqual([]);
    });

    it('should normalize "prubezny" to "průběžný"', () => {
        const html = `
        <table id="tmtab_1">
            <tbody>
                <tr>
                    <td>1</td>
                    <td>prubezny test 1</td>
                    <td>10</td>
                    <td>20</td>
                    <td>z</td>
                    <td>50 %</td>
                    <td>1.1.2026</td>
                    <td>Teacher</td>
                </tr>
            </tbody>
        </table>`;
        const results = parseAssessmentTable(html);
        expect(results[0].name).toBe('průběžný test 1');
    });
});
