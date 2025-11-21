import { fetchWithAuth } from "./client";
import type { ParsedFile, FileAttachment } from "../types/documents";

import { fetchSubjects } from "./subjects";

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

export async function fetchFilesFromFolder(folderUrl: string): Promise<ParsedFile[]> {
    try {
        const response = await fetchWithAuth(folderUrl);
        const html = await response.text();
        return parseServerFiles(html);
    } catch (error) {
        console.error("Failed to fetch files:", error);
        return [];
    }
}

export function parseServerFiles(html: string): ParsedFile[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('tr.uis-hl-table.lbn');

    const files: ParsedFile[] = [];

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let adder = 0;
        if (cells[0].classList.contains("UISTMNumberCell")) {
            adder = 1;
        }

        if (cells.length < (7 + adder)) return;

        const subfolder = cells[(adder)].textContent?.trim() || '';
        const file_name = cells[(1 + adder)].textContent?.trim() || '';
        const file_comment = cells[(2 + adder)].textContent?.trim() || '';

        const authorLink = cells[(3 + adder)].querySelector('a');
        const author = authorLink ? authorLink.textContent?.trim() || '' : cells[(3 + adder)].textContent?.trim() || '';

        const date = cells[(4 + adder)].textContent?.trim() || '';

        const filesCell = cells[(6 + adder)];
        const fileLinks = filesCell.querySelectorAll('a');

        const extractedFiles: FileAttachment[] = [];
        fileLinks.forEach(link => {
            const img = link.querySelector('img[sysid]');
            if (img) {
                const sysid = img.getAttribute('sysid') || '';
                const type = sysid.startsWith('mime-') ? sysid.replace('mime-', '') : sysid;

                extractedFiles.push({
                    name: file_name,
                    type: type,
                    link: link.getAttribute('href') || ''
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
    return files;
}
