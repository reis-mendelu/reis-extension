import type { FilesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import type { ParsedFile } from '../../types/documents';

export const createFilesSlice: AppSlice<FilesSlice> = (set, get) => ({
    files: {},
    filesLoading: {},
    fetchFiles: async (courseCode) => {
        const { files, filesLoading } = get();
        const currentLang = get().language;
        
        // Check if already in memory AND language matches
        const cachedFiles = files[courseCode];
        const languageMatches = cachedFiles && cachedFiles.length > 0 && cachedFiles[0]?.language === currentLang;
        
        if (cachedFiles && languageMatches && !filesLoading[courseCode]) {
            // Cache is valid and language matches
            return;
        }

        set((state) => ({
            filesLoading: { ...state.filesLoading, [courseCode]: true }
        }));

        try {
            const data = await IndexedDBService.get('files', courseCode);
            let languageMatches = false;

            // Handle dual-language structure vs legacy array
            let filesList: ParsedFile[] = [];
            if (data && 'cz' in data && 'en' in data) {
                 // Dual language structure
                 filesList = currentLang === 'en' ? data.en : data.cz;
                 languageMatches = true; // Always matches since we have both
            } else if (Array.isArray(data)) {
                 // Legacy array structure
                 filesList = data;
                 languageMatches = data.length > 0 && data[0]?.language === currentLang;
            }
            
            if (!languageMatches && data) {
                // Language mismatch in legacy structure - fetch fresh data from API
                console.log(`[FilesSlice] Language mismatch for ${courseCode}...`);
                
                const { fetchFilesFromFolder } = await import('../../api/documents/service');
                const subjectsData = await IndexedDBService.get('subjects', 'current');
                const subject = subjectsData?.data?.[courseCode];
                
                if (subject?.folderUrl) {
                    const folderId = subject.folderUrl.match(/[?&;]id=(\d+)/)?.[1];
                    if (folderId) {
                        const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
                        try {
                            const czFiles = await fetchFilesFromFolder(folderUrl, 'cs');
                            const enFiles = await fetchFilesFromFolder(folderUrl, 'en');
                            const dualData = { cz: czFiles || [], en: enFiles || [] };
                            await IndexedDBService.set('files', courseCode, dualData);
                            filesList = currentLang === 'en' ? dualData.en : dualData.cz;
                        } catch (err) {
                            console.error(`[FilesSlice] Failed to re-fetch:`, err);
                        }
                    }
                }
            }
            
            set((state) => ({
                files: { ...state.files, [courseCode]: filesList },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        } catch (error) {
            console.error(`[FilesSlice] Fetch failed for ${courseCode}:`, error);
            set((state) => ({
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        }
    },
    fetchAllFiles: async () => {
        try {
            const currentLang = get().language;
            const allFiles = await IndexedDBService.getAllWithKeys('files');
            const filesMap: Record<string, ParsedFile[]> = {};

            allFiles.forEach(({ key, value }) => {
                if (value && 'cz' in value && 'en' in value) {
                    filesMap[key] = currentLang === 'en' ? value.en : value.cz;
                } else if (Array.isArray(value)) {
                    filesMap[key] = value;
                }
            });
            set({ files: filesMap });
        } catch (error) {
            console.error('[FilesSlice] Fetch all failed:', error);
        }
    },
});
