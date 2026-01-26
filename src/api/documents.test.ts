/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { describe, it, expect } from 'vitest';
import { parseServerFiles } from './documents';

describe('parseServerFiles', () => {
    it('should parse a standard document folder table correctly', () => {
        const html = `
            <table>
                <tr class="uis-hl-table lbn">
                    <td class="UISTMNumberCell">1</td>
                    <td class="odsazena">ZS 2024/2025</td>
                    <td class="odsazena"><a href="download.pl?id=123">Lecture Notes.pdf</a></td>
                    <td class="odsazena">First lecture</td>
                    <td class="odsazena">John Doe</td>
                    <td class="odsazena">01. 09. 2024</td>
                    <td class="odsazena"><a>View</a></td>
                    <td class="odsazena"><a href="download.pl?id=123"><img sysid="mime-pdf"></a></td>
                </tr>
            </table>
        `;
        const { files } = parseServerFiles(html);
        
        expect(files).toHaveLength(1);
        expect(files[0].file_name).toBe('Lecture Notes.pdf');
        expect(files[0].subfolder).toBe('ZS 2024/2025');
        expect(files[0].author).toBe('John Doe');
        expect(files[0].files).toHaveLength(1);
        expect(files[0].files[0].type).toBe('pdf');
    });

    it('should parse a document detail page correctly', () => {
        const html = `
            <table>
                <tr><td>Name:</td><td>Main Presentation</td></tr>
                <tr><td>Entered by:</td><td>Jane Smith</td></tr>
                <tr><td>Document date:</td><td>10. 10. 2024</td></tr>
                <tr><td>Comments:</td><td>Full slides</td></tr>
                <tr><td>Attachments:</td><td><a href="download.pl?id=456"><img sysid="mime-ppt"></a></td></tr>
            </table>
        `;
        const { files } = parseServerFiles(html);
        
        expect(files).toHaveLength(1);
        expect(files[0].file_name).toBe('Main Presentation');
        expect(files[0].author).toBe('Jane Smith');
        expect(files[0].file_comment).toBe('Full slides');
        expect(files[0].files[0].type).toBe('ppt');
    });

    it('should handle pagination links', () => {
        const html = `
            <a href="slozka.pl?id=1;od=11;do=20">11-20</a>
            <a href="slozka.pl?id=1;od=21;do=30">21-30</a>
        `;
        const { paginationLinks } = parseServerFiles(html);
        
        expect(paginationLinks).toContain('slozka.pl?id=1;od=11;do=20');
        expect(paginationLinks).toContain('slozka.pl?id=1;od=21;do=30');
    });

    it('should return empty lists for invalid HTML', () => {
        const { files, paginationLinks } = parseServerFiles('<div>Not a table</div>');
        expect(files).toHaveLength(0);
        expect(paginationLinks).toHaveLength(0);
    });
});
