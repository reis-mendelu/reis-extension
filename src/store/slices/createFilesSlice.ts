import type { FilesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import type { ParsedFile } from '../../types/documents';

export const createFilesSlice: AppSlice<FilesSlice> = (set, get) => ({
    files: {},
    filesLoading: {},
    filesPriorityLoading: {},
    filesProgress: {},
    filesTotalCount: {},
    fetchFiles: async (courseCode) => {
        const { files, filesLoading } = get();

        // We skip if:
        // 1. We're already loading this course
        // 2. We have cached files (even if empty [])
        if (filesLoading[courseCode] || files[courseCode] !== undefined) {
            return;
        }

        // Set loading synchronously before any await so the skeleton renders immediately
        set((state) => ({
            filesLoading: { ...state.filesLoading, [courseCode]: true }
        }));

        await get().refreshFiles(courseCode);
    },
    fetchFilesPriority: async (courseCode) => {
        const { files, filesPriorityLoading, language: currentLang } = get();

        // Already loading, or files have been fetched (even if empty — [] means "synced, no files")
        if (filesPriorityLoading[courseCode] || Array.isArray(files[courseCode])) {
            return;
        }

        set((state) => ({
            filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: true },
            filesProgress: { ...state.filesProgress, [courseCode]: 'initializing' }
        }));

        try {
            // Check IndexedDB first
            const cached = await IndexedDBService.get('files', courseCode);
            if (cached) {
                const data = (cached as { cz?: ParsedFile[], en?: ParsedFile[] })[currentLang] || [];
                set((state) => ({
                    files: { ...state.files, [courseCode]: data },
                    filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: false },
                    filesProgress: { ...state.filesProgress, [courseCode]: 'success' },
                    filesTotalCount: { ...state.filesTotalCount, [courseCode]: data.length }
                }));
                return;
            }

            // Wait for metadata and handshake
            let subjects = get().subjects;
            let syncStatus = get().syncStatus;

            if (!syncStatus.handshakeDone || !subjects) {
                set((state) => ({ filesProgress: { ...state.filesProgress, [courseCode]: 'waiting_metadata' } }));
                const { useAppStore } = await import('../useAppStore');
                await new Promise<void>((resolve) => {
                    const unsubscribe = useAppStore.subscribe((state) => {
                        if (state.syncStatus.handshakeDone && state.subjects) {
                            unsubscribe();
                            subjects = state.subjects;
                            syncStatus = state.syncStatus;
                            resolve();
                        }
                    });
                    setTimeout(() => { unsubscribe(); resolve(); }, 5000);
                });
            }

            const { fetchFilesFromFolder } = await import('../../api/documents/service');
            const subject = subjects?.data?.[courseCode];

            if (!subject?.folderUrl) {
                const isSyncActive = syncStatus.isSyncing || !syncStatus.handshakeDone;
                if (!isSyncActive) {
                    set((state) => ({
                        files: { ...state.files, [courseCode]: [] },
                        filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: false },
                        filesProgress: { ...state.filesProgress, [courseCode]: 'success' }
                    }));
                } else {
                    set((state) => ({ filesProgress: { ...state.filesProgress, [courseCode]: 'waiting_sync' } }));
                }
                return;
            }

            const folderId = subject.folderUrl.match(/[?&;]id=(\d+)/)?.[1];
            if (!folderId) {
                set((state) => ({
                    files: { ...state.files, [courseCode]: [] },
                    filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: false },
                    filesProgress: { ...state.filesProgress, [courseCode]: 'success' }
                }));
                return;
            }

            const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;

            set((state) => ({
                filesProgress: { ...state.filesProgress, [courseCode]: 'fetching_first' }
            }));

            // Fetch with onChunk callback for progressive update
            const fullFilesList = await fetchFilesFromFolder(folderUrl, currentLang, true, 0, 2, (chunk) => {
                set((state) => ({
                    files: { ...state.files, [courseCode]: chunk },
                    filesProgress: { ...state.filesProgress, [courseCode]: 'syncing_remaining' }
                }));
            });

            // Store full data in IndexedDB
            const cachedFiles = await IndexedDBService.get('files', courseCode);
            const data = (cachedFiles || { cz: [], en: [] }) as { cz: ParsedFile[], en: ParsedFile[] };
            if (currentLang === 'en') data.en = fullFilesList; else data.cz = fullFilesList;
            await IndexedDBService.set('files', courseCode, data);

            set((state) => ({
                files: { ...state.files, [courseCode]: fullFilesList },
                filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: false },
                filesProgress: { ...state.filesProgress, [courseCode]: 'success' },
                filesTotalCount: { ...state.filesTotalCount, [courseCode]: fullFilesList.length }
            }));
        } catch (e) {
            console.warn('[FilesSlice] fetchFilesPriority failed:', e);
            set((state) => ({
                files: { ...state.files, [courseCode]: [] },
                filesPriorityLoading: { ...state.filesPriorityLoading, [courseCode]: false },
                filesProgress: { ...state.filesProgress, [courseCode]: 'error' }
            }));
        }
    },
    refreshFiles: async (courseCode) => {
        const { language: currentLang } = get();
        
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
                
                const { fetchFilesFromFolder } = await import('../../api/documents/service');
                const subjectsData = await IndexedDBService.get('subjects', 'current');
                const subject = subjectsData?.data?.[courseCode];
                
                if (subject?.folderUrl) {
                    const folderId = subject.folderUrl.match(/[?&;]id=(\d+)/)?.[1];
                    if (folderId) {
                        const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
                        try {
                            const [czFiles, enFiles] = await Promise.all([
                                fetchFilesFromFolder(folderUrl, 'cz'),
                                fetchFilesFromFolder(folderUrl, 'en')
                            ]);
                            const dualData = { cz: czFiles || [], en: enFiles || [] };
                            await IndexedDBService.set('files', courseCode, dualData);
                            filesList = currentLang === 'en' ? dualData.en : dualData.cz;
                        } catch (e) {
                            console.warn('[FilesSlice] language re-fetch failed:', e);
                            // Re-fetch failed, use existing data
                        }
                    }
                }
            }
            
            set((state) => ({
                files: { ...state.files, [courseCode]: filesList },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        } catch (e) {
            console.warn('[FilesSlice] refreshFiles failed:', e);
            set((state) => ({
                files: { ...state.files, [courseCode]: state.files[courseCode] ?? [] },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        }
    },
    fetchAllFiles: async () => {
        try {
            const currentLang = get().language;
            // Scope to currently enrolled courses instead of scanning the whole
            // 'files' store (which accumulates historical semesters).
            const subjectsData = get().subjects?.data
                ?? (await IndexedDBService.get('subjects', 'current'))?.data;
            const courseCodes = subjectsData ? Object.keys(subjectsData) : [];
            if (courseCodes.length === 0) {
                set({ files: {} });
                return;
            }

            const entries = await Promise.all(
                courseCodes.map(async (code) => {
                    const value = await IndexedDBService.get('files', code);
                    return [code, value] as const;
                })
            );

            const filesMap: Record<string, ParsedFile[]> = {};
            for (const [code, value] of entries) {
                if (value && 'cz' in value && 'en' in value) {
                    filesMap[code] = currentLang === 'en' ? value.en : value.cz;
                } else if (Array.isArray(value)) {
                    filesMap[code] = value;
                }
            }
            set({ files: filesMap });
        } catch (e) { console.warn('[FilesSlice] fetchAllFiles failed:', e); }
    },
});
