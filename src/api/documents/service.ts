import { fetchWithAuth, BASE_URL } from "../client";
import { requestQueue, processWithDelay } from "../../utils/requestQueue";
import { parseServerFiles } from "./parser";
import { fetchSubjects } from "../subjects";
import type { ParsedFile, FileAttachment } from "../../types/documents";

export async function fetchDocumentsForSubject(subjectCode: string): Promise<FileAttachment[]> {
    const subjectsData = await fetchSubjects();
    const subject = subjectsData?.data[subjectCode];
    if (!subject?.folderUrl) return [];
    const parsedFiles = await fetchFilesFromFolder(subject.folderUrl);
    return parsedFiles.flatMap(pf => pf.files);
}

export async function fetchFilesFromFolder(folderUrl: string, recursive = true, currentDepth = 0, maxDepth = 2): Promise<ParsedFile[]> {
    try {
        let url = folderUrl;
        if (!url.includes('lang=')) url += (url.includes('?') ? ';' : '?') + 'lang=cz';

        const response = await fetchWithAuth(url);
        const { files, paginationLinks } = parseServerFiles(await response.text());

        for (const link of paginationLinks) {
            const pageUrl = link.startsWith('http') ? link : `${BASE_URL}/auth/dok_server/${link.replace(/^\//, '')}`;
            const pageResult = await requestQueue.add(async () => parseServerFiles(await (await fetchWithAuth(pageUrl)).text()));
            files.push(...pageResult.files);
        }

        if (recursive && currentDepth < maxDepth) {
            const folders = files.filter(f => f.files.some(fi => fi.link.includes('slozka.pl') && !fi.link.includes('download')))
                .map(f => ({ url: f.files[0].link.startsWith('http') ? f.files[0].link : `${BASE_URL}/auth/dok_server/${f.files[0].link.replace(/^\//, '')}`, name: f.file_name }));

            const subResults = await processWithDelay(folders, async f => {
                const results = await fetchFilesFromFolder(f.url, true, currentDepth + 1, maxDepth);
                results.forEach(r => r.subfolder = f.name);
                return results;
            }, 200);

            const all = [...files, ...subResults.flat()];
            const unique = new Map();
            all.forEach(f => { if (f.files.length > 0) unique.set(f.files[0].link, f); });
            return Array.from(unique.values()).filter(f => f.files.some(fi => fi.link.includes('download') || !fi.link.includes('slozka.pl')));
        }
        return files;
    } catch (e) { return []; }
}
