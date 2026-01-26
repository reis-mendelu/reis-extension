import { describe, it, expect } from 'vitest';
import { parseSyllabusOffline } from '../syllabusParser';

describe('syllabusParser', () => {
    /**
     * Test Case 1: Full syllabus with both text requirements and grading table
     * Simulates a typical IS Mendelu syllabus page
     */
    const FULL_SYLLABUS_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><strong>Požadavky na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        Student je povinen:<br>
                        - Zúčastnit se minimálně 80 % přednášek<br>
                        - Odevzdat všechny semestrální projekty<br>
                        - Získat minimálně 50 bodů ze 100 možných
                    </td>
                </tr>
            </table>
            
            <table>
                <tr>
                    <td><b>Rozložení požadavků na ukončení</b></td>
                </tr>
                <tr>
                    <td>
                        <table>
                            <tr>
                                <th>Aktivita</th>
                                <th>Body</th>
                                <th>Min. body</th>
                            </tr>
                            <tr>
                                <td>Průběžné testy</td>
                                <td>40</td>
                                <td>20</td>
                            </tr>
                            <tr>
                                <td>Semestrální projekt</td>
                                <td>30</td>
                                <td>15</td>
                            </tr>
                            <tr>
                                <td>Závěrečná zkouška</td>
                                <td>30</td>
                                <td>15</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should parse full syllabus with both text and table', () => {
        const result = parseSyllabusOffline(FULL_SYLLABUS_HTML);

        // Verify text requirements
        expect(result.requirementsText).toContain('Student je povinen:');
        expect(result.requirementsText).toContain('Zúčastnit se minimálně 80 % přednášek');
        expect(result.requirementsText).toContain('Odevzdat všechny semestrální projekty');
        
        // Verify text preserves newlines (from <br> tags)
        expect(result.requirementsText.split('\n').length).toBeGreaterThan(1);

        // Verify table structure
        expect(result.requirementsTable).toHaveLength(4); // Header + 3 data rows
        
        // Check header row
        expect(result.requirementsTable[0]).toEqual(['Aktivita', 'Body', 'Min. body']);
        
        // Check data rows
        expect(result.requirementsTable[1]).toEqual(['Průběžné testy', '40', '20']);
        expect(result.requirementsTable[2]).toEqual(['Semestrální projekt', '30', '15']);
        expect(result.requirementsTable[3]).toEqual(['Závěrečná zkouška', '30', '15']);
    });

    /**
     * Test Case 2: Only text requirements, no table
     * Some subjects might not have a detailed grading breakdown
     */
    const TEXT_ONLY_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><span><strong>Požadavky na ukončení</strong></span></td>
                </tr>
                <tr>
                    <td>
                        Pro udělení zápočtu je nutné:<br>
                        <br>
                        1. Aktivní účast na cvičeních<br>
                        2. Splnění všech domácích úkolů<br>
                        3. Úspěšné absolvování závěrečného testu
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should parse text-only requirements without table', () => {
        const result = parseSyllabusOffline(TEXT_ONLY_HTML);

        expect(result.requirementsText).toContain('Pro udělení zápočtu je nutné:');
        expect(result.requirementsText).toContain('Aktivní účast na cvičeních');
        expect(result.requirementsText).toContain('Splnění všech domácích úkolů');
        
        // Should have empty table
        expect(result.requirementsTable).toEqual([]);
    });

    /**
     * Test Case 3: Complex table with percentage grading
     * Real-world example with detailed point distribution
     */
    const COMPLEX_TABLE_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><b>Požadavky na ukončení</b></td>
                </tr>
                <tr>
                    <td>Klasifikovaný zápočet</td>
                </tr>
            </table>
            
            <table>
                <tr>
                    <td><strong>Rozložení požadavků na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        <table>
                            <tr>
                                <th>Aktivita</th>
                                <th>Max. body</th>
                                <th>Procento</th>
                            </tr>
                            <tr>
                                <td>Aktivita na cvičeních</td>
                                <td>10</td>
                                <td>10 %</td>
                            </tr>
                            <tr>
                                <td>Průběžné testy (3x)</td>
                                <td>30</td>
                                <td>30 %</td>
                            </tr>
                            <tr>
                                <td>Projekt</td>
                                <td>20</td>
                                <td>20 %</td>
                            </tr>
                            <tr>
                                <td>Finální test</td>
                                <td>40</td>
                                <td>40 %</td>
                            </tr>
                            <tr>
                                <td><strong>Celkem</strong></td>
                                <td><strong>100</strong></td>
                                <td><strong>100 %</strong></td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should parse complex grading table with percentages', () => {
        const result = parseSyllabusOffline(COMPLEX_TABLE_HTML);

        expect(result.requirementsText).toBe('Klasifikovaný zápočet');
        
        expect(result.requirementsTable).toHaveLength(6); // Header + 4 activities + total
        expect(result.requirementsTable[0]).toEqual(['Aktivita', 'Max. body', 'Procento']);
        expect(result.requirementsTable[1]).toEqual(['Aktivita na cvičeních', '10', '10 %']);
        expect(result.requirementsTable[3]).toEqual(['Projekt', '20', '20 %']); // Index 3, not 4
        
        // Check total row (should preserve bold text as regular text)
        expect(result.requirementsTable[5]).toEqual(['Celkem', '100', '100 %']);
    });

    /**
     * Test Case 4: Missing requirements section
     * Edge case where syllabus doesn't have the expected sections
     */
    const MISSING_SECTION_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><b>Anotace předmětu</b></td>
                </tr>
                <tr>
                    <td>Tento předmět se zabývá...</td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should handle missing requirements section gracefully', () => {
        const result = parseSyllabusOffline(MISSING_SECTION_HTML);

        expect(result.requirementsText).toBe('Error: Section not found');
        expect(result.requirementsTable).toEqual([]);
    });

    /**
     * Test Case 5: Whitespace normalization
     * Ensure excessive whitespace is cleaned up
     */
    const WHITESPACE_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><strong>Požadavky na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        Text   s    mnoha     mezerami
                    </td>
                </tr>
            </table>
            
            <table>
                <tr>
                    <td><strong>Rozložení požadavků na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        <table>
                            <tr>
                                <td>Test     s     mezerami</td>
                                <td>25    %</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should normalize excessive whitespace in text and table', () => {
        const result = parseSyllabusOffline(WHITESPACE_HTML);

        // Text should have single spaces
        expect(result.requirementsText).toBe('Text s mnoha mezerami');
        
        // Table cells should have normalized whitespace
        expect(result.requirementsTable[0]).toEqual(['Test s mezerami', '25 %']);
    });

    /**
     * Test Case 6: Special characters and Czech diacritics
     * Ensure proper encoding and handling of Czech characters
     */
    const CZECH_CHARS_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><b>Požadavky na ukončení</b></td>
                </tr>
                <tr>
                    <td>
                        Zápočet z předmětu: žádoucí úroveň znalostí<br>
                        Řešení úkolů s českou diakritikou: ě, š, č, ř, ž, ý, á, í, é
                    </td>
                </tr>
            </table>
            
            <table>
                <tr>
                    <td><strong>Rozložení požadavků na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        <table>
                            <tr>
                                <td>Řešení příkladů</td>
                                <td>60 bodů</td>
                            </tr>
                            <tr>
                                <td>Účast na přednáškách</td>
                                <td>40 bodů</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should preserve Czech diacritics correctly', () => {
        const result = parseSyllabusOffline(CZECH_CHARS_HTML);

        expect(result.requirementsText).toContain('žádoucí úroveň znalostí');
        expect(result.requirementsText).toContain('ě, š, č, ř, ž, ý, á, í, é');
        
        expect(result.requirementsTable[0]).toEqual(['Řešení příkladů', '60 bodů']);
        expect(result.requirementsTable[1]).toEqual(['Účast na přednáškách', '40 bodů']);
    });

    /**
     * Test Case 7: Empty HTML / Malformed input
     */
    it('should handle empty HTML gracefully', () => {
        const result = parseSyllabusOffline('');
        
        expect(result.requirementsText).toBe('Error: Section not found');
        expect(result.requirementsTable).toEqual([]);
    });

    it('should handle null/undefined input gracefully', () => {
        const result1 = parseSyllabusOffline(null as unknown as string);
        const result2 = parseSyllabusOffline(undefined as unknown as string);
        
        expect(result1.requirementsText).toBe('Error: Section not found');
        expect(result1.requirementsTable).toEqual([]);
        
        expect(result2.requirementsText).toBe('Error: Section not found');
        expect(result2.requirementsTable).toEqual([]);
    });

    /**
     * Test Case 8: Table with mixed th/td headers
     * Some tables use <td> for headers instead of <th>
     */
    const MIXED_HEADERS_HTML = `
    <html>
        <body>
            <table>
                <tr>
                    <td><b>Požadavky na ukončení</b></td>
                </tr>
                <tr>
                    <td>Zkouška</td>
                </tr>
            </table>
            
            <table>
                <tr>
                    <td><strong>Rozložení požadavků na ukončení</strong></td>
                </tr>
                <tr>
                    <td>
                        <table>
                            <tr>
                                <td><strong>Typ</strong></td>
                                <td><strong>Body</strong></td>
                            </tr>
                            <tr>
                                <td>Písemná zkouška</td>
                                <td>70</td>
                            </tr>
                            <tr>
                                <td>Ústní zkouška</td>
                                <td>30</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    `;

    it('should handle tables with <td> headers (instead of <th>)', () => {
        const result = parseSyllabusOffline(MIXED_HEADERS_HTML);

        expect(result.requirementsText).toBe('Zkouška');
        
        // Parser should capture th AND td cells
        expect(result.requirementsTable).toHaveLength(3);
        expect(result.requirementsTable[0]).toEqual(['Typ', 'Body']);
        expect(result.requirementsTable[1]).toEqual(['Písemná zkouška', '70']);
        expect(result.requirementsTable[2]).toEqual(['Ústní zkouška', '30']);
    });
});
