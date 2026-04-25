import { sanitizeString, validateFileName, validateUrl } from "../../utils/validation/index";
import { ParserError } from "../../utils/parsers/parserGuards";
import { reportError } from "../../utils/reportError";
import type { ParsedFile, FileAttachment } from "../../types/documents";

/**
 * Maps table header names to their corresponding column indices.
 */
function getColumnIndices(table: Element): Record<string, number> {
    const indices: Record<string, number> = {};
    const headers = Array.from(table.querySelectorAll('thead th, tr.zahlavi th, tr.zahlavi td'));
    
    headers.forEach((th, i) => {
        const text = th.textContent?.trim().toLowerCase() || '';
        if ((text.includes('název') || text.includes('name')) && indices.name === undefined) indices.name = i;
        else if ((text.includes('vložil') || text.includes('entered by')) && indices.author === undefined) indices.author = i;
        else if ((text.includes('datum dokumentu') || text.includes('document date')) && indices.date === undefined) indices.date = i;
        else if (text.includes('poslední změna') || text.includes('last change') || text.includes('modifikace')) {
            if (indices.date === undefined) indices.date = i;
        }
        else if ((text.includes('komentář') || text.includes('comment')) && indices.comment === undefined) indices.comment = i;
        else if ((text.includes('ozn.') || text.includes('subfolder')) && indices.subfolder === undefined) indices.subfolder = i;
    });
    
    return indices;
}

export function parseServerFiles(html: string): { files: ParsedFile[], paginationLinks: string[], totalRecords?: number } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const files: ParsedFile[] = [];
    const paginationLinks: string[] = [];
    let totalRecords: number | undefined;

    // Case 1: Read document page (detail page)
    const attachmentsLabel = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Attachments:') || td.textContent?.includes('Přílohy:'));
    if (attachmentsLabel) {
        const row = attachmentsLabel.parentElement;
        const link = row?.querySelector('a')?.getAttribute('href');
        if (link) {
            const tableRows = Array.from(doc.querySelectorAll('tr'));
            const findValue = (regex: RegExp) => tableRows.find(tr => regex.test(tr.textContent || ''))?.querySelectorAll('td')[1]?.textContent?.trim() || '';
            
            const name = findValue(/Name:|Názov:|Název:/);
            const author = findValue(/Entered by:|Vložil:|Zadal:/);
            const date = findValue(/Document date:|Datum dokumentu:|Dátum dokumentu:/);
            const comment = findValue(/Comments:|Poznámka:|Komentář:/);
            const type = row?.querySelector('img[sysid]')?.getAttribute('sysid')?.replace('mime-', '') || 'unknown';

            const sName = validateFileName(name || 'Unknown');
            const vUrl = validateUrl(link, 'is.mendelu.cz');
            if (sName && vUrl) {
                return { files: [{ subfolder: '', file_name: sName, file_comment: sanitizeString(comment, 500), author: sanitizeString(author, 200), date, files: [{ name: sName, type, link: vUrl }] }], paginationLinks: [], totalRecords: 1 };
            }
        }
    }

    // Case 2: Folder list / Tables
    const tables = Array.from(doc.querySelectorAll('table')).filter(t => !t.classList.contains('portal_menu'));

    tables.forEach(table => {
        const indices = getColumnIndices(table);
        if (indices.name === undefined) return;

        const rows = Array.from(table.querySelectorAll('tr.uis-hl-table.lbn, tbody tr')).filter(r => r.querySelectorAll('td').length >= 2);
        
        rows.forEach(row => {
          try {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return;

            const adder = (cells[0]?.classList.contains("UISTMNumberCell") || cells[0]?.classList.contains("UISTMNumberCellHidden") || cells[0]?.querySelector('input[type="checkbox"]')) ? 1 : 0;

            const nameIdx = indices.name ?? (1 + adder);
            const authorIdx = indices.author ?? (3 + adder);
            const dateIdx = indices.date ?? (4 + adder);
            const commentIdx = indices.comment ?? (2 + adder);
            const subfolderIdx = indices.subfolder ?? adder;

            if (nameIdx >= cells.length) {
                throw new ParserError('name', 'parseServerFiles', `nameIdx ${nameIdx} >= cells.length ${cells.length}`, row.outerHTML.slice(0, 500));
            }

            const nameCell = cells[nameIdx];
            const file_name = validateFileName(nameCell?.textContent || '');
            if (!file_name) return;

            const subfolder = sanitizeString(cells[subfolderIdx]?.textContent || '', 100);
            const author = sanitizeString(cells[authorIdx]?.textContent || '', 200);
            const date = sanitizeString(cells[dateIdx]?.textContent || '', 50);
            const file_comment = sanitizeString(cells[commentIdx]?.textContent || '', 500);

            const extractedFiles: FileAttachment[] = [];
            Array.from(row.querySelectorAll('a')).forEach(l => {
                const href = l.getAttribute('href');
                if (!href) return;
                const vUrl = validateUrl(href.startsWith('http') ? href : (href.startsWith('/') ? href : `/auth/dok_server/${href.replace(/^\.\//, '')}`), 'is.mendelu.cz');
                
                const isSystemLabel = /Všechny moje složky|Nadřazená složka|All my folders|Parent folder|Document tree|New documents|DS settings|Searching|Dokumentový strom|Nové dokumenty|Nastavení stromu|Vyhledávání/i.test(file_name);
                const isSystemUrl = /moje_dok\.pl|nove_dok\.pl|nastaveni_stromu\.pl|vyhledavani\.pl|index\.pl|clovek\.pl|dokumenty_ct\.pl/.test(vUrl || '');

                if (!vUrl || isSystemLabel || isSystemUrl) return;

                const sysid = l.querySelector('img[sysid]')?.getAttribute('sysid') || '';
                if (sysid === 'mime-prohlizeni-info') return;

                const type = sysid ? sysid.replace('mime-', '') : 'unknown';
                if (type === 'prohlizeni-info') return;
                
                const existing = extractedFiles.find(f => f.link === vUrl);
                if (existing) {
                    if (existing.type === 'unknown' && type !== 'unknown') existing.type = type;
                    return;
                }

                extractedFiles.push({ name: file_name, type, link: vUrl });
            });

            if (extractedFiles.length > 0) {
                files.push({ subfolder, file_name, file_comment, author, date, files: extractedFiles });
            }
          } catch (e) {
            if (e instanceof ParserError) reportError('Parser.parseServerFiles', e, { snippet: e.snippet });
            else throw e;
          }
        });
    });

    doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href?.includes('slozka.pl') && !href.includes('download') && a.textContent?.trim().match(/^\d+[-–]\d+$/)) {
            if (!paginationLinks.includes(href)) paginationLinks.push(href);
        }
    });

    // Try to find total records count (e.g. "1-10 z 24")
    const bodyText = doc.body.textContent || '';
    const totalMatch = bodyText.match(/(\d+)\s*[-–]\s*(\d+)\s+(?:z|of)\s+(\d+)/i);
    if (totalMatch) {
        totalRecords = parseInt(totalMatch[3], 10);
    }

    return { files, paginationLinks, totalRecords };
}
