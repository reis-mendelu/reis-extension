import { sanitizeString, validateFileName, validateUrl } from "../../utils/validation";
import type { ParsedFile, FileAttachment } from "../../types/documents";

export function parseServerFiles(html: string): { files: ParsedFile[], paginationLinks: string[] } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const files: ParsedFile[] = [];
    const paginationLinks: string[] = [];

    // Case 1: Read document page (detail page)
    const attachmentsLabel = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Attachments:') || td.textContent?.includes('Přílohy:'));
    if (attachmentsLabel) {
        const row = attachmentsLabel.parentElement;
        const link = row?.querySelector('a')?.getAttribute('href');
        if (link) {
            const name = Array.from(doc.querySelectorAll('td')).find(td => /Name:|Názov:|Název:/.test(td.textContent || ''))?.parentElement?.querySelectorAll('td')[1]?.textContent?.trim() || 'Unknown';
            const author = Array.from(doc.querySelectorAll('td')).find(td => /Entered by:|Vložil:|Zadal:/.test(td.textContent || ''))?.parentElement?.querySelectorAll('td')[1]?.textContent?.trim() || '';
            const date = Array.from(doc.querySelectorAll('td')).find(td => /Document date:|Datum dokumentu:|Dátum dokumentu:/.test(td.textContent || ''))?.parentElement?.querySelectorAll('td')[1]?.textContent?.trim() || '';
            const comment = Array.from(doc.querySelectorAll('td')).find(td => /Comments:|Poznámka:|Komentář:/.test(td.textContent || ''))?.parentElement?.querySelectorAll('td')[1]?.textContent?.trim() || '';
            const type = row?.querySelector('img[sysid]')?.getAttribute('sysid')?.replace('mime-', '') || 'unknown';

            const sName = validateFileName(name);
            const vUrl = validateUrl(link, 'is.mendelu.cz');
            if (sName && vUrl) {
                return { files: [{ subfolder: '', file_name: sName, file_comment: sanitizeString(comment, 500), author: sanitizeString(author, 200), date, files: [{ name: sName, type, link: vUrl }] }], paginationLinks: [] };
            }
        }
    }

    // Case 2: Folder list
    let rows: any = doc.querySelectorAll('tr.uis-hl-table.lbn');
    if (rows.length === 0) rows = Array.from(doc.querySelectorAll('table tr')).filter(r => r.querySelectorAll('td').length >= 5);

    doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href?.includes('slozka.pl') && !href.includes('download') && a.textContent?.trim().match(/^\d+-\d+$/)) {
            if (!paginationLinks.includes(href)) paginationLinks.push(href);
        }
    });

    rows.forEach((row: Element) => {
        const cells = row.querySelectorAll('td');
        const adder = (cells[0]?.classList.contains("UISTMNumberCell") || cells[0]?.querySelector('input[type="checkbox"]')) ? 1 : 0;
        if (cells.length < (2 + adder)) return;

        const subfolder = sanitizeString(cells[adder]?.textContent || '', 100);
        const nameCell = cells[1 + adder];
        const file_name = validateFileName(nameCell?.textContent || '');
        if (!file_name) return;

        let link = nameCell?.querySelector('a') || Array.from(cells).find(c => c.querySelector('a'))?.querySelector('a');
        if (!link) return;

        const author = sanitizeString(cells[3 + adder]?.textContent || '', 200);
        const date = sanitizeString(cells[4 + adder]?.textContent || '', 50);
        const extractedFiles: FileAttachment[] = [];

        Array.from(row.querySelectorAll('a')).forEach(l => {
            const href = l.getAttribute('href');
            if (!href) return;
            const vUrl = validateUrl(href.startsWith('http') ? href : (href.startsWith('/') ? href : `/auth/dok_server/${href.replace(/^\.\//, '')}`), 'is.mendelu.cz');
            if (!vUrl || /Všechny moje složky|Nadřazená složka/.test(file_name)) return;

            const sysid = l.querySelector('img[sysid]')?.getAttribute('sysid') || '';
            const type = sysid ? sysid.replace('mime-', '') : 'unknown';
            
            const existing = extractedFiles.find(f => f.link === vUrl);
            if (existing) {
                if (existing.type === 'unknown' && type !== 'unknown') existing.type = type;
                return;
            }

            extractedFiles.push({ name: file_name, type, link: vUrl });
        });

        if (extractedFiles.length > 0) {
            files.push({ subfolder, file_name, file_comment: sanitizeString(cells[2 + adder]?.textContent || '', 500), author, date, files: extractedFiles });
        }
    });

    return { files, paginationLinks };
}
