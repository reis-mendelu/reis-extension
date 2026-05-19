import type { FilesSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import type { ParsedFile } from '../../types/documents';
import {
    fetchAndPersistFolderFiles,
    persistLastFetched,
    FILES_LAST_FETCHED_KEY,
} from './files/refreshFilesForSubject';
import { loadAllFilesFromCache } from './files/fetchAllFiles';
import { prefetchTodaySubjectsImpl } from './files/prefetchTodaySubjects';
import { speculativeRefreshFilesImpl } from './files/speculativeRefreshFiles';

export const createFilesSlice: AppSlice<FilesSlice> = (set, get) => ({
    files: {},
    filesLoading: {},
    lastFilesFetchedAt: {},
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

            if (!syncStatus?.handshakeDone || !subjects) {
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

            // Always persist under the language used at fetch time (correct regardless of current lang).
            const cachedFiles = await IndexedDBService.get('files', courseCode);
            const data = (cachedFiles || { cz: [], en: [] }) as { cz: ParsedFile[], en: ParsedFile[] };
            if (currentLang === 'en') data.en = fullFilesList; else data.cz = fullFilesList;
            await IndexedDBService.set('files', courseCode, data);

            // Language may have changed while the fetch was in flight — display the right one.
            const activeLang = get().language;
            const displayList = activeLang === currentLang ? fullFilesList
                : (activeLang === 'en' ? data.en : data.cz);

            const nextLast = { ...get().lastFilesFetchedAt, [courseCode]: Date.now() };
            persistLastFetched(nextLast);
            set((state) => ({
                files: { ...state.files, [courseCode]: displayList },
                filesLoading: { ...state.filesLoading, [courseCode]: false },
                lastFilesFetchedAt: nextLast,
            }));
        } catch (e) {
            logError('FilesSlice.fetchFilesPriority', e, { courseCode });
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
                            logError('FilesSlice.refreshFiles:langRefetch', e, { courseCode });
                        }
                    }
                }
            }

            set((state) => ({
                files: { ...state.files, [courseCode]: filesList },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        } catch (e) {
            logError('FilesSlice.refreshFiles', e, { courseCode });
            set((state) => ({
                files: { ...state.files, [courseCode]: state.files[courseCode] ?? [] },
                filesLoading: { ...state.filesLoading, [courseCode]: false }
            }));
        }
    },
    refreshFilesForSubject: async (courseCode) => {
        const { language: currentLang, subjects } = get();
        set((state) => ({ filesLoading: { ...state.filesLoading, [courseCode]: true } }));
        try {
            const result = await fetchAndPersistFolderFiles({ courseCode, language: currentLang, subjects });
            if (!result) {
                set((state) => ({ filesLoading: { ...state.filesLoading, [courseCode]: false } }));
                return;
            }
            const activeLang = get().language;
            const displayList = activeLang === currentLang
                ? result.displayList
                : (((await IndexedDBService.get('files', courseCode)) as { cz: ParsedFile[]; en: ParsedFile[] } | null)?.[activeLang] ?? result.displayList);
            const nextLast = { ...get().lastFilesFetchedAt, [courseCode]: result.fetchedAt };
            persistLastFetched(nextLast);
            set((state) => ({
                files: { ...state.files, [courseCode]: displayList },
                filesLoading: { ...state.filesLoading, [courseCode]: false },
                lastFilesFetchedAt: nextLast,
            }));
        } catch (e) {
            logError('FilesSlice.refreshFilesForSubject', e, { courseCode });
            set((state) => ({ filesLoading: { ...state.filesLoading, [courseCode]: false } }));
        }
    },
    hydrateLastFilesFetchedAt: async () => {
        try {
            const cached = await IndexedDBService.get('meta', FILES_LAST_FETCHED_KEY);
            if (cached && typeof cached === 'object') {
                set({ lastFilesFetchedAt: cached as Record<string, number> });
            }
        } catch (e) { logError('FilesSlice.hydrateLastFilesFetchedAt', e); }
    },
    fetchAllFiles: async () => {
        const files = await loadAllFilesFromCache({ language: get().language, subjects: get().subjects });
        set({ files });
    },
    prefetchTodaySubjects: () => {
        const { schedule, lastFilesFetchedAt } = get();
        prefetchTodaySubjectsImpl({
            schedule: schedule.data,
            lastFilesFetchedAt,
            refreshFilesForSubject: (code) => get().refreshFilesForSubject(code),
        });
    },
    speculativeRefreshFiles: (courseCode) => {
        const { lastFilesFetchedAt, filesLoading } = get();
        speculativeRefreshFilesImpl({
            courseCode,
            lastFilesFetchedAt,
            filesLoading,
            refreshFilesForSubject: (code) => get().refreshFilesForSubject(code),
        });
    },
});
