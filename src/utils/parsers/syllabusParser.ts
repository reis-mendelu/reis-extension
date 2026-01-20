import type { SyllabusRequirements } from '../../types/documents';

/**
 * Parses the raw HTML string of the syllabus page to extract requirements.
 * Operates independently of the current window/document context.
 * 
 * This parser extracts two key pieces of information:
 * 1. Textual description of course completion requirements
 * 2. Structured grading table showing point distribution
 * 
 * @param htmlString - The raw HTML text returned from a fetch request
 * @returns Structured data containing the text requirements and the grading table
 */
export function parseSyllabusOffline(htmlString: string): SyllabusRequirements {
    // Handle null/undefined/empty input gracefully
    if (!htmlString || typeof htmlString !== 'string') {
        console.debug('[parseSyllabusOffline] Invalid input, returning empty result');
        return {
            requirementsText: 'Error: Section not found',
            requirementsTable: []
        };
    }

    // 1. ISOLATION: Create a virtual document
    // This exists only in memory and doesn't rely on the browser's rendered DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    /**
     * Helper: Locate the content row based on a header text anchor.
     * We use traversal rather than XPath for better cross-environment compatibility.
     * 
     * @param searchText - The text to search for in header elements
     * @returns The content row (TR element) following the header, or null if not found
     */
    function getContentRowByHeader(searchText: string): Element | null {
        // Expand search to common header tags to ensure we catch it
        const allCandidates = Array.from(doc.querySelectorAll("b, span, strong, h1, h2, h3"));
        
        const headerEl = allCandidates.find(el => 
            el.textContent && el.textContent.includes(searchText)
        );

        if (!headerEl) {
            console.debug(`[parseSyllabusOffline] Header "${searchText}" not found`);
            return null;
        }

        // Traverse up to the layout table row (TR)
        const headerRow = headerEl.closest("tr");
        if (!headerRow || !headerRow.nextElementSibling) {
            console.debug(`[parseSyllabusOffline] No content row found after "${searchText}"`);
            return null;
        }

        return headerRow.nextElementSibling;
    }

    // --- EXTRACTION 1: Qualitative Data (Text) ---
    let requirementsText = 'Error: Section not found';
    const textRow = getContentRowByHeader("Požadavky na ukončení");
    
    if (textRow) {
        // PREVENT DATA LOSS: DOMParser's .textContent swallows <br> tags.
        // We must manually convert <br> to newlines to preserve paragraph structure.
        const contentCell = textRow.querySelector("td");
        if (contentCell) {
            // Clone to avoid mutating the original parsed doc (good hygiene)
            const clone = contentCell.cloneNode(true) as HTMLElement;
            
            // Replace <br> with newline characters
            clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
            
            // Now extract text, trimming excessive whitespace but keeping newlines
            const rawText = clone.textContent || '';
            
            // Normalize whitespace: convert multiple spaces to single space, but preserve newlines
            requirementsText = rawText
                .split('\n')
                .map(line => line.trim().replace(/\s+/g, ' '))
                .filter(line => line.length > 0)
                .join('\n');
        }
    }

    // --- EXTRACTION 2: Quantitative Data (Table) ---
    let requirementsTable: string[][] = [];
    const tableRow = getContentRowByHeader("Rozložení požadavků na ukončení");

    if (tableRow) {
        const innerTable = tableRow.querySelector("table");
        if (innerTable) {
            const rows = Array.from(innerTable.querySelectorAll("tr"));
            
            requirementsTable = rows
                .map(row => {
                    const cells = Array.from(row.querySelectorAll("th, td"));
                    return cells.map(cell => 
                        // Normalize whitespace: Turn "25   %" into "25 %"
                        (cell.textContent || '').trim().replace(/\s+/g, " ")
                    );
                })
                .filter(row => row.length > 0); // Filter out empty rows
        } else {
            console.debug('[parseSyllabusOffline] Table structure found, but inner table is missing');
        }
    }

    // --- RETURN OBJECT ---
    const result: SyllabusRequirements = {
        requirementsText,
        requirementsTable
    };

    console.debug('[parseSyllabusOffline] Parsed result:', {
        textLength: result.requirementsText.length,
        tableRows: result.requirementsTable.length
    });

    return result;
}
