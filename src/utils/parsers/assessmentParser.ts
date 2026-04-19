import type { Assessment } from '../../types/documents';
import { AssessmentSchema } from '../../schemas/assessmentSchema';

/**
 * Parse assessment table from IS Mendelu.
 * Implements dynamic structure detection to handle variations (with/without row numbering).
 */
export function parseAssessmentTable(html: string): Assessment[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find the table
    const table = doc.getElementById('tmtab_1');
    if (!table) {
        // This is expected for subjects without assessments (e.g., sports)
        return [];
    }
    
    // Get rows from tbody
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const results: Assessment[] = [];
    
    // Helper to parse Czech float format (comma to dot)
    const parseCzechFloat = (str: string) => 
        parseFloat(str.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
        
    // Helper to check if string looks like a score number (e.g., "0,50", "1", "12,00")
    const isScoreLike = (str: string): boolean => {
        const clean = str.replace(',', '.').trim();
        return !isNaN(parseFloat(clean)) && /^[0-9]+([.,][0-9]+)?$/.test(clean);
    };
    
    // Debug: log first row structure logic - keeping it silent unless issues arise
    /*
    if (rows.length > 0) {
        const firstCells = rows[0].querySelectorAll('td');
        const c1 = firstCells[1]?.textContent?.trim() || '';
        const c2 = firstCells[2]?.textContent?.trim() || '';
        
        const c1IsScore = isScoreLike(c1);
        
        console.debug(`[parseAssessmentTable] Structure check:`, {
            cell1: c1,
            cell2: c2,
            cell1IsScore: c1IsScore,
            detectedShift: c1IsScore ? 0 : 1
        });
    }
    */
    
    rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        
        // Safety check - minimal length (previously 7, but let's be flexible)
        if (cells.length < 6) return;
        
        const c1Text = cells[1]?.textContent?.trim() || '';
        const shift = isScoreLike(c1Text) ? 0 : 1;
        
        // Extract data using shift
        const nameRaw = cells[0 + shift]?.textContent?.trim() || '';
        const name = nameRaw.replace(/prubezny/gi, 'průběžný');
        if (!name || (shift === 1 && name.match(/^\d+$/))) {
            // If we shifted and name still looks like just a number, maybe logic failed?
            // But usually this works.
        }
        
        const score = parseCzechFloat(cells[1 + shift]?.textContent || '0');
        const maxScore = parseCzechFloat(cells[2 + shift]?.textContent || '0');
        
        // Skip result type column (usually +3+shift)
        
        const successRate = parseCzechFloat(cells[4 + shift]?.textContent || '0');
        const submittedDate = cells[5 + shift]?.textContent?.trim() || '';
        const teacher = cells[6 + shift]?.textContent?.trim() || '';
        
        // Detail link usually at the end
        const detailLink = cells[7 + shift]?.querySelector('a');
        const detailUrl = detailLink?.getAttribute('href') || undefined;
        
        const assessmentRaw = {
            name,
            score,
            maxScore,
            successRate,
            submittedDate,
            teacher,
            detailUrl
        };

        // Validation Firewall
        const result = AssessmentSchema.safeParse(assessmentRaw);
        if (result.success) {
            results.push(result.data);
        }
    });
    
    return results;
}
