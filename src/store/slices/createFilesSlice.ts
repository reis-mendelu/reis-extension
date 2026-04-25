import type { FilesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { reportError } from '../../utils/reportError';
import type { ParsedFile } from '../../types/documents';

export const createFilesSlice: AppSlice<FilesSlice> = (set, get) => ({
    files: {},
    filesLoading: {},
    fetchFiles: async (courseCode) => {
        const { files, filesLoading } = get();

        if (filesLoading[courseCode] || files[courseCode] !== undefined) {
            return;
        }

        set((state) => ({
            filesLoading: { ...state.filesLoading, [courseCode]: true }
        }));

        await get().refreshFiles(courseCode);
    },
    fetchFilesPriority: async (courseCode) => {
        const { files, filesLoading, language: currentLang } = get();

        if (filesLoading[courseCode] || files[courseCode] !== undefined) {
            return;
        }

        set((state) => ({
            filesLoading: { ...state.filesLoading, [courseCode]: true }
        }));

        try {
            // Check IndexedDB first
            const cached = await IndexedDBService.get('files', courseCode);
            if (cached) {
                const data = (cached as { cz?: ParsedFile[], en?: ParsedFile[] })[currentLang] || [];
                set((state) => ({
                    files: { ...state.files, [courseCode]: data },
                    filesLoading: { ...state.filesLoading, [courseCode]: false },
                }));
                return;
            }

            // Wait for metadata and handshake
            let subjects = get().subjects;
            let syncStatus = get().syncStatus;

            if (!syncStatus.handshakeDone || !subjects) {
                const { useAppStore } = await import('../useAppStore');
                await new Promise<void>((resolve) => {
                    // Re-check synchronously inside the Promise — handles the race where
                    // handshake completed between the outer get() and this subscription.
                    const current = useAppStore.getState();
                    if (current.syncStatus.handshakeDone && current.subjects) {
                        subjects = current.subjects;
                        syncStatus = current.syncStatus;
                        resolve();
                        return;
                    }
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
                set((state) => ({
                    files: isSyncActive ? state.files : { ...state.files, [courseCode]: [] },
                    filesLoading: { ...state.filesLoading, [courseCode]: false },
                }));
                return;
            }

            const folderId = subject.folderUrl.match(/[?&;]id=(\d+)/)?.[1];
            if (!folderId) {
                set((state) => ({
                    files: { ...state.files, [courseCode]: [] },
                    filesLoading: { ...state.filesLoading, [courseCode]: false },
                }));
                return;
            }

            const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
            const fullFilesList = await fetchFilesFromFolder(folderUrl, currentLang, true, 0, 2);

            // Store full data in IndexedDB
            const cachedFiles = await IndexedDBService.get('files', courseCode);
            const data = (cachedFiles || { cz: [], en: [] }) as { cz: ParsedFile[], en: ParsedFile[] };
            if (currentLang === 'en') data.en = fullFilesList; else data.cz = fullFilesList;
            await IndexedDBService.set('files', courseCode, data);

            set((state) => ({
                files: { ...state.files, [courseCode]: fullFilesList },
                filesLoading: { ...state.filesLoading, [courseCode]: false },
            }));
        } catch (e) {
            reportError('FilesSlice.fetchFilesPriority', e, { courseCode });
            set((state) => ({
                files: { ...state.files, [courseCode]: [] },
                filesLoading: { ...state.filesLoading, [courseCode]: false },
            }));
        }
    },
    refreshFiles: async (courseCode) => {
        const { language: currentLang, files } = get();

        if (!files[courseCode]) {
            set((state) => ({
                filesLoading: { ...state.filesLoading, [courseCode]: true }
            }));
        }

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
                            reportError('FilesSlice.refreshFiles:langRefetch', e, { courseCode });
                        }
                    }
                }
            }

            set((state) => ({
                files: { ...state.files, [courseCode]: filesList },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        } catch (e) {
            reportError('FilesSlice.refreshFiles', e, { courseCode });
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
        } catch (e) { reportError('FilesSlice.fetchAllFiles', e); }
    },
});
