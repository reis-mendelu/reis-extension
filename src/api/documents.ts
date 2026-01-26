/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { fetchWithAuth, BASE_URL } from "./client";
import type { ParsedFile, FileAttachment } from "../types/documents";
import { fetchSubjects } from "./subjects";
import { sanitizeString, validateFileName, validateUrl } from "../utils/validation";
import { requestQueue, processWithDelay } from "../utils/requestQueue";
import { createLogger } from "../utils/logger";

const log = createLogger('Files');

export async function fetchDocumentsForSubject(subjectCode: string): Promise<FileAttachment[]> {
    const subjectsData = await fetchSubjects();
    if (!subjectsData) return [];

    const subject = subjectsData.data[subjectCode];
    if (!subject || !subject.folderUrl) return [];

    const parsedFiles = await fetchFilesFromFolder(subject.folderUrl);

    // Flatten the structure to just return all files for now, or we could keep the folder structure
    // The dialog expects FileAttachment[], so let's flatten
    const allFiles: FileAttachment[] = [];
    parsedFiles.forEach(pf => {
        allFiles.push(...pf.files);
    });

    return allFiles;
}

export async function fetchFilesFromFolder(folderUrl: string, recursive: boolean = true, currentDepth: number = 0, maxDepth: number = 2): Promise<ParsedFile[]> {
    console.log(`[REIS Files] 📂 Scraping folder: ${folderUrl} (depth: ${currentDepth})`);
    try {
        // Ensure lang=cz is present
        let urlToFetch = folderUrl;
        if (!urlToFetch.includes('lang=')) {
            urlToFetch += (urlToFetch.includes('?') ? ';' : '?') + 'lang=cz';
        }

        log.debug(`Fetching folder: ${urlToFetch} (depth: ${currentDepth}/${maxDepth})`);
        const response = await fetchWithAuth(urlToFetch);
        const html = await response.text();
        const { files, paginationLinks } = parseServerFiles(html);
        log.info(`Found ${files.length} items, ${paginationLinks.length} pagination pages`);

        // Handle pagination
        if (paginationLinks && paginationLinks.length > 0) {
            // We need to fetch other pages. 
            // paginationLinks contains links to ALL pages (including the current one usually, or at least others).
            // We should fetch them all and merge results, removing duplicates if any.
            // A simple strategy: 
            // 1. We have files from current page.
            // 2. Filter paginationLinks to exclude current page if possible, or just fetch all unique links found in pagination that are NOT the current URL.
            // However, IS Mendelu pagination links usually look like "slozka.pl?id=...;od=11;..."

            // Let's just fetch all unique pagination links that we haven't fetched yet.
            // To avoid infinite loops or re-fetching current, we can check if the link is different.

            // Fetch pagination pages sequentially via request queue to avoid overwhelming the server
            for (const link of paginationLinks) {
                // Construct absolute URL
                let pageUrl = link.startsWith('http') ? link : `${BASE_URL}/auth/dok_server/${link.replace(/^\/auth\/dok_server\//, '')}`;

                // Ensure lang=cz
                if (!pageUrl.includes('lang=')) {
                    pageUrl += (pageUrl.includes('?') ? ';' : '?') + 'lang=cz';
                }

                // Use request queue to throttle concurrent requests
                const pageResult = await requestQueue.add(async () => {
                    const pageResponse = await fetchWithAuth(pageUrl);
                    const pageHtml = await pageResponse.text();
                    return parseServerFiles(pageHtml);
                });
                files.push(...pageResult.files);
            }
        }

        // If recursive mode is enabled, fetch files from subfolders too
        if (recursive && currentDepth < maxDepth) {
            const allFiles: ParsedFile[] = [...files];

            // Collect folders to fetch, then process sequentially with delay
            const foldersToFetch: { absoluteUrl: string; parentName: string }[] = [];

            for (const file of files) {
                // Check if this is a folder link (not a downloadable file)
                // Folders usually have slozka.pl and NO download parameter
                const isFolder = file.files.some(f =>
                    f.link.includes('slozka.pl') && !f.link.includes('download')
                );

                if (isFolder && file.files.length > 0) {
                    const folderLink = file.files[0].link;
                    let absoluteUrl: string;

                    // Robust handling for slozka.pl links
                    if (folderLink.includes('slozka.pl')) {
                        if (folderLink.startsWith('http')) {
                            absoluteUrl = folderLink;
                        } else {
                            absoluteUrl = `${BASE_URL}/auth/dok_server/${folderLink.replace(/^\/auth\/dok_server\//, '')}`;
                        }
                    } else {
                        absoluteUrl = folderLink.startsWith('http')
                            ? folderLink
                            : folderLink.startsWith('/')
                                ? `${BASE_URL}${folderLink}`
                                : `${BASE_URL}/auth/dok_server/${folderLink}`;
                    }

                    foldersToFetch.push({ absoluteUrl, parentName: file.file_name });
                }
            }

            // Fetch subfolders sequentially with 200ms delay to avoid overwhelming the server
            const subfolderResults = await processWithDelay(
                foldersToFetch,
                async ({ absoluteUrl, parentName }) => {
                    const subfolderFiles = await fetchFilesFromFolder(absoluteUrl, true, currentDepth + 1, maxDepth);
                    // Add subfolder info to each file
                    subfolderFiles.forEach(sf => {
                        sf.subfolder = parentName;
                    });
                    return subfolderFiles;
                },
                200 // 200ms delay between subfolder fetches
            );

            // Merge all subfolder results
            subfolderResults.forEach(files => allFiles.push(...files));

            // Filter out folder entries, keep only actual files
            // Also deduplicate files based on link just in case pagination caused overlaps
            const uniqueFiles = new Map<string, ParsedFile>();
            allFiles.forEach(f => {
                // Use the first file's link as key (assuming one file per ParsedFile entry usually)
                if (f.files.length > 0) {
                    const key = f.files[0].link;
                    // Only keep if it's a download link or we haven't seen it
                    if (!uniqueFiles.has(key) || (key.includes('download') && !uniqueFiles.get(key)?.files[0].link.includes('download'))) {
                        uniqueFiles.set(key, f);
                    }
                }
            });

            return Array.from(uniqueFiles.values()).filter(file =>
                file.files.some(f => f.link.includes('download') || !f.link.includes('slozka.pl'))
            );
        }

        return files;
    } catch (error) {
        log.error(`Failed to fetch folder: ${folderUrl}`, error);
        return [];
    }
}

export function parseServerFiles(html: string): { files: ParsedFile[], paginationLinks: string[] } {
    console.debug('[parseServerFiles] Starting parse, HTML length:', html.length);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const files: ParsedFile[] = [];
    const paginationLinks: string[] = [];

    // Check if this is a "Read document" page (detail page)
    const attachmentsLabel = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Attachments:') || td.textContent?.includes('Přílohy:'));
    if (attachmentsLabel) {
        const row = attachmentsLabel.parentElement;
        const link = row?.querySelector('a')?.getAttribute('href');

        if (link) {
            // Extract metadata from other rows
            const nameRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Name:') || td.textContent?.includes('Názov:') || td.textContent?.includes('Název:'))?.parentElement;
            const name = nameRow?.querySelectorAll('td')[1]?.textContent?.trim() || 'Unknown';

            const authorRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Entered by:') || td.textContent?.includes('Vložil:') || td.textContent?.includes('Zadal:'))?.parentElement;
            const author = authorRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const dateRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Document date:') || td.textContent?.includes('Datum dokumentu:') || td.textContent?.includes('Dátum dokumentu:'))?.parentElement;
            const date = dateRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const commentRow = Array.from(doc.querySelectorAll('td')).find(td => td.textContent?.includes('Comments:') || td.textContent?.includes('Poznámka:') || td.textContent?.includes('Komentář:'))?.parentElement;
            const comment = commentRow?.querySelectorAll('td')[1]?.textContent?.trim() || '';

            const img = row?.querySelector('img[sysid]');
            const type = img?.getAttribute('sysid')?.replace('mime-', '') || 'unknown';

            // Sanitize extracted metadata
            const sanitizedName = validateFileName(name);
            const sanitizedComment = sanitizeString(comment, 500);
            const sanitizedAuthor = sanitizeString(author, 200);
            const validatedUrl = validateUrl(link, 'is.mendelu.cz');

            if (sanitizedName && validatedUrl) {
                return {
                    files: [{
                        subfolder: '',
                        file_name: sanitizedName,
                        file_comment: sanitizedComment,
                        author: sanitizedAuthor,
                        date: date,
                        files: [{
                            name: sanitizedName,
                            type: type,
                            link: validatedUrl
                        }]
                    }],
                    paginationLinks: []
                };
            }
        }
    }

    // Try multiple selectors to find the table rows
    // The screenshot shows rows with alternating colors, likely standard IS Mendelu tables
    let rows = doc.querySelectorAll('tr.uis-hl-table.lbn');

    // If no rows found, try less strict selector
    if (rows.length === 0) {
        console.debug('[parseServerFiles] No .uis-hl-table.lbn rows, trying .uis-hl-table');
        rows = doc.querySelectorAll('tr.uis-hl-table');
    }

    // If still no rows, try even more general but filter for data rows
    if (rows.length === 0) {
        // Select all rows that have at least 5 cells (likely data rows)
        const allRows = doc.querySelectorAll('table tr');
        const dataRows: Element[] = [];
        allRows.forEach(r => {
            const cells = r.querySelectorAll('td');
            // Check for data rows
            if (cells.length >= 5) {
                dataRows.push(r);
            }
        });

        // Convert to NodeList-like structure for compatibility if needed, or just map
        // For now, let's just iterate the array
        rows = dataRows as any;
        console.debug('[parseServerFiles] Found', dataRows.length, 'data rows via fallback');
    } else {
        console.debug('[parseServerFiles] Found', rows.length, 'rows via class selector');
    }

    // Robust pagination detection: Scan ALL links in the document
    // This avoids issues where pagination rows are not inside the expected table structure
    const allLinks = doc.querySelectorAll('a');
    allLinks.forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim() || '';

        // Check for pagination links
        // Pattern 1: Text matches "11-20", "21-30", etc.
        // Pattern 2: Link contains "typ=mod" (often used for pagination/sorting) AND text is numeric range
        if (href && href.includes('slozka.pl') && !href.includes('download')) {
            if (text.match(/^\d+-\d+$/)) {
                if (!paginationLinks.includes(href)) {
                    paginationLinks.push(href);
                }
            }
        }
    });

    rows.forEach((row) => {
        const cells = row.querySelectorAll('td');

        // Skip rows with too few cells
        // Based on screenshot: Folder | Name | Comment | Inserted By | Date | View | Attach
        // That's 7 columns. Some might be hidden or merged.
        // Let's be lenient and say at least 5.


        let adder = 0;
        // Check for checkbox/number column
        if (cells[0] && (cells[0].classList.contains("UISTMNumberCell") || cells[0].querySelector('input[type="checkbox"]'))) {
            adder = 1;
        }

        // More lenient check - if it has a link, we try to parse it
        const hasLink = Array.from(cells).some(c => c.querySelector('a[href*="download"]') || c.querySelector('a[href*="slozka.pl"]'));

        // We need at least 2 cells (Name + Link usually)
        if (cells.length < 2) {
            return;
        }

        // If it doesn't have a link and has few cells, skip it
        if (!hasLink && cells.length < (5 + adder)) {
            return;
        }

        const subfolder = sanitizeString(cells[(adder)]?.textContent || '', 100);
        const nameCell = cells[(1 + adder)];
        let link = nameCell?.querySelector('a');
        const file_name = validateFileName(nameCell?.textContent || '');

        // If the name cell doesn't have a link, look for it in other cells
        if (!link) {
            const allCells = Array.from(cells);
            // Priority 1: Direct download link
            const downloadLink = allCells.find(c => c.querySelector('a[href*="download"]'))?.querySelector('a');
            if (downloadLink) {
                link = downloadLink;
            } else {
                // Priority 2: Folder link or Document view link
                const otherLink = allCells.find(c => c.querySelector('a[href*="slozka.pl"]') || c.querySelector('a[href*="dokumenty_cteni.pl"]'))?.querySelector('a');
                if (otherLink) {
                    link = otherLink;
                }
            }
        }

        if (!link) {
            return;
        }

        // href at line 314 was unused, removing it.
        const file_comment = sanitizeString(cells[(2 + adder)]?.textContent || '', 500);

        const authorLink = cells[(3 + adder)]?.querySelector('a');
        const author = sanitizeString(
            authorLink ? authorLink.textContent || '' : cells[(3 + adder)]?.textContent || '',
            200
        );

        const date = sanitizeString(cells[(4 + adder)]?.textContent || '', 50);

        // Skip rows with invalid/empty file names
        if (!file_name) {
            return;
        }

        // Look for file links - try multiple cell indices starting from the end
        // Usually the last two columns are View and Attach
        const filesCell = cells[cells.length - 1];
        const viewCell = cells[cells.length - 2];

        // Collect links from both View and Attach cells
        const potentialLinks: Element[] = [];
        if (viewCell) potentialLinks.push(...Array.from(viewCell.querySelectorAll('a')));
        if (filesCell) potentialLinks.push(...Array.from(filesCell.querySelectorAll('a')));

        // Also add the main link we found if it's not already in potentialLinks (by href comparison)
        // This handles cases where the link is in the name column or elsewhere but not in the last 2 columns
        if (link && !potentialLinks.some(pl => pl.getAttribute('href') === link?.getAttribute('href'))) {
            potentialLinks.push(link);
        }

        const extractedFiles: FileAttachment[] = [];

        potentialLinks.forEach(link => {
            const img = link.querySelector('img[sysid]');
            let href = link.getAttribute('href') || '';

            // Fix relative paths for document server scripts
            // If it's a relative link like "slozka.pl?..." or "dokumenty_cteni.pl?...", 
            // we need to make it absolute path relative to /auth/dok_server/
            if (!href.startsWith('http') && !href.startsWith('/')) {
                // Remove leading ./ if present
                let cleanHref = href;
                if (cleanHref.startsWith('./')) {
                    cleanHref = cleanHref.substring(2);
                }

                if (cleanHref.startsWith('slozka.pl') || cleanHref.startsWith('dokumenty_cteni.pl')) {
                    href = `/auth/dok_server/${cleanHref}`;
                }
            }

            // DO NOT replace ; with & here. IS Mendelu needs ;
            // Just ensure we don't have double ??

            // Validate URL before adding
            const validatedUrl = validateUrl(href, 'is.mendelu.cz');
            if (!validatedUrl) {
                return;
            }

            // Filter out navigation links / folders that look like files
            if (file_name.includes('Všechny moje složky') ||
                file_name.includes('Nadřazená složka') ||
                file_name.includes('Zobrazení dokumentů') ||
                file_name.includes('Strom od složky') ||
                link.textContent?.includes('Všechny moje složky') ||
                link.textContent?.includes('Nadřazená složka') ||
                link.textContent?.includes('Zobrazení dokumentů') ||
                link.textContent?.includes('Strom od složky')) {
                return;
            }

            if (img) {
                const sysid = img.getAttribute('sysid') || '';
                const type = sysid.startsWith('mime-') ? sysid.replace('mime-', '') : sysid;

                extractedFiles.push({
                    name: file_name,
                    type: sanitizeString(type, 50),
                    link: validatedUrl
                });
            } else if (href && (href.includes('download') || href.includes('.pl'))) {
                // If it's a text link or other icon
                // For folders (slozka.pl without download), we only want to add them if we are NOT recursing (handled in fetchFilesFromFolder)
                // BUT parseServerFiles is used by fetchFilesFromFolder which then filters.
                // However, we should be careful not to add "folder views" as "files" unless they are the only thing.

                // Actually, fetchFilesFromFolder uses these entries to recurse. 
                // So we MUST return them, but maybe mark them?
                // The current logic adds them as "unknown" type files.

                extractedFiles.push({
                    name: file_name || sanitizeString(link.textContent || 'Unknown', 200),
                    type: 'unknown',
                    link: validatedUrl
                });
            }
        });

        if (extractedFiles.length > 0) {
            files.push({
                subfolder,
                file_name,
                file_comment,
                author,
                date,
                files: extractedFiles
            });
        }
    });

    console.debug('[parseServerFiles] Parse complete. Files:', files.length, ', Pagination:', paginationLinks.length);
    return { files, paginationLinks };
}
