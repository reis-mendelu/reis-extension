import { fetchWithAuth } from "../client";
import { requestQueue, processWithDelay } from "../../utils/requestQueue";
import { parseServerFiles } from "./parser";
import { fetchSubjects } from "../subjects";
import { validateUrl } from "../../utils/validation/index";
import type { ParsedFile, FileAttachment } from "../../types/documents";

export async function fetchDocumentsForSubject(subjectCode: string): Promise<FileAttachment[]> {
    const subjectsData = await fetchSubjects();
    const subject = subjectsData?.data[subjectCode];
    if (!subject?.folderUrl) return [];
    const parsedFiles = await fetchFilesFromFolder(subject.folderUrl);
    return parsedFiles.flatMap(pf => pf.files);
}

export async function fetchFilesFromFolder(folderUrl: string, lang: string = 'cz', recursive = true, currentDepth = 0, maxDepth = 2): Promise<ParsedFile[]> {
    try {
        // Append language parameter if not already present
        let url = folderUrl;
        if (!url.includes('lang=')) {
            url += url.includes('?') ? `;lang=${lang}` : `?lang=${lang}`;
        }

        const response = await fetchWithAuth(url);
        const respText = await response.text();
        const { files: initialFiles, paginationLinks } = parseServerFiles(respText);
        const allFiles = [...initialFiles];

        console.log(`[fetchFilesFromFolder] ${folderUrl} - Page 1: Found ${initialFiles.length} files, ${paginationLinks.length} pagination links`);

        // Use Promise.allSettled for pagination to be resilient
        const pageRequests = paginationLinks.map(async (link) => {
            const pageUrl = link.startsWith('http') ? link : validateUrl(link.startsWith('/') ? link : `/auth/dok_server/${link.replace(/^\.\//, '')}`, 'is.mendelu.cz');
            if (!pageUrl) return [];
            
            try {
                const pageResp = await requestQueue.add(async () => fetchWithAuth(pageUrl));
                const { files: pageFiles } = parseServerFiles(await pageResp.text());
                console.log(`[fetchFilesFromFolder]   - Paged ${pageUrl}: Found ${pageFiles.length} files`);
                return pageFiles;
            } catch (err) {
                console.warn(`[fetchFilesFromFolder]   - Paged ${pageUrl} failed, skipping:`, err);
                return [];
            }
        });

        const extraResults = await Promise.all(pageRequests);
        allFiles.push(...extraResults.flat());

        if (recursive && currentDepth < maxDepth) {
            const folders = allFiles.filter(f => f.files.some(fi => fi.link.includes('slozka.pl') && !fi.link.includes('download')))
                .map(f => ({ 
                    url: f.files[0].link, // Already absolute from parser
                    name: f.file_name 
                }));

            console.log(`[fetchFilesFromFolder] ${folderUrl} - Found ${folders.length} subfolders to recurse (Depth ${currentDepth})`);

            const subResults = await processWithDelay(folders, async f => {
                try {
                    const results = await fetchFilesFromFolder(f.url, lang, true, currentDepth + 1, maxDepth);
                    results.forEach(r => r.subfolder = f.name);
                    return results;
                } catch (err) {
                    console.warn(`[fetchFilesFromFolder] Subfolder ${f.name} failed (recurse depth ${currentDepth}), skipping:`, err);
                    return [];
                }
            }, 200);

            allFiles.push(...subResults.flat());
        }

        // Final Deduplication using a more robust key (link + filename)
        const unique = new Map<string, ParsedFile>();
        allFiles.forEach(f => {
            if (f.files.length > 0) {
                const key = `${f.files[0].link}_${f.file_name}`;
                unique.set(key, f);
            }
        });

        const finalResults = Array.from(unique.values()).filter(f => 
            f.files.some(fi => fi.link.includes('download') || !fi.link.includes('slozka.pl'))
        );

        // Tag all files with the language they were fetched in
        finalResults.forEach(f => f.language = lang);

        console.log(`[fetchFilesFromFolder] ${folderUrl} - Done. Total unique files: ${finalResults.length}`);
        return finalResults;
    } catch (e) {
        console.error(`[fetchFilesFromFolder] Failed to fetch folder ${folderUrl}:`, e);
        throw e;
    }
}
