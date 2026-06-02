import pLimit from "p-limit";
import { Messages } from "../types/messages";
import { fetchDualLanguageExams } from "../api/exams";
import { fetchDualLanguageSubjects } from "../api/subjects";
import { fetchDualLanguagePastSubjects } from "../api/pastSubjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchDualLanguageStudyPlan } from "../api/studyPlan";
import { fetchStudyStats } from "../api/studyStats";
import { fetchSyllabus } from "../api/syllabus";
import { syncZaznamnik } from "../services/sync/syncZaznamnik";
import { syncCvicneTests } from "../services/sync/syncCvicneTests";
import { syncOdevzdavarny } from "../services/sync/syncOdevzdavarny";
import { fetchSeminarGroupIds, fetchClassmates } from "../api/classmates";
import { mergePastSubjects } from "../services/sync/mergePastSubjects";
import { syncPastSemesters } from "../services/sync/syncPastSemesters";

import { getUserParams } from "../utils/userParams";
import { fetchFullSemesterSchedule } from "./dataFetchers";
import { sendToIframe } from "./iframeManager";
import { SYNC_INTERVAL } from "./config";
import type { SyncedData } from "../types/messages";
import { IndexedDBService } from "../services/storage/IndexedDBService";
import { syncDriveBackup, type DriveBackupSubject } from "../services/drive/driveBackup";
import { syncDriveNotesBackup } from "../services/drive/driveNotesBackup";
import { NOTES_ENABLED } from "../config/featureFlags";
import type { SubjectNotes } from "../services/drive/notesDoc";
import { singleFlight } from "../utils/singleFlight";
import { logError } from "../utils/reportError";
import type { ParsedFile, SubjectsData } from "../types/documents";


const limit = pLimit(3);
export let cachedData: SyncedData = { lastSync: 0 };

// Emit the student's schedule the instant it resolves — before the rest of the
// sync batch settles — so the calendar paints in ~1–3s on first open.
export function emitScheduleFirst(schedule: unknown[], lastSync: number) {
    if (!schedule || schedule.length === 0) return;
    sendToIframe(Messages.syncUpdate({ schedule: schedule as never, isSyncing: true, lastSync }));
}
export let isSyncing = false;

/** Latest notes snapshot pushed from the iframe (it owns the notes IDB). */
export function setNotesSnapshot(notes: Record<string, Record<string, { note: string; fileName: string }>>) {
    cachedData = { ...cachedData, notes };
}

/** Per-subject base64-inlined HTML pushed by the iframe for image-bearing notes.
 *  Used in place of the text-only render so card images reach the Drive Doc. */
const notesHtmlOverrides: Record<string, string> = {};
export function setNotesHtmlOverride(code: string, html: string): void {
    notesHtmlOverrides[code] = html;
}
let currentSemesterCodes: string[] = [];
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export async function syncAllData() {
    if (isSyncing) return;
    
    isSyncing = true;
    sendToIframe(Messages.syncUpdate({ isSyncing: true, lastSync: cachedData.lastSync }));

    try {
        const userParams = await getUserParams();
        const studium = userParams?.studium;

        // Phase 2a: Start subjects early — fast fetch (explicit obdobi prevents session-state coupling)
        const subjectsPromise = fetchDualLanguageSubjects(studium || undefined, userParams?.obdobi || undefined)
            .then(result => {
                if (result) {
                    cachedData = { ...cachedData, subjects: result.subjects, attendance: result.attendance };
                    // Capture current-semester codes BEFORE mergePastSubjects adds past ones —
                    // the Drive backup is scoped to the current semester only.
                    currentSemesterCodes = result.subjects?.data ? Object.keys(result.subjects.data) : [];
                }
                return result;
            });

        // Phase 2a-II: Fetch study plan + study stats concurrently with early subjects
        const studyPlanPromise = studium ? fetchDualLanguageStudyPlan(studium).then(plan => {
            if (plan) {
                cachedData = { ...cachedData, studyPlan: plan };
            }
            return plan;
        }) : Promise.resolve(null);

        // Past-semester folders from doc server history — used to backfill
        // SubjectInfo for fulfilled subjects that list.pl no longer returns.
        const pastSubjectsPromise = fetchDualLanguagePastSubjects();

        const studyStatsPromise = (studium && userParams?.obdobi)
            ? fetchStudyStats(studium, userParams.obdobi).then(stats => {
                if (stats) cachedData = { ...cachedData, studyStats: stats };
                return stats;
            })
            : Promise.resolve(null);

        const cvicneTestsPromise = studium ? syncCvicneTests(studium).then(result => {
            if (result) {
                cachedData = { ...cachedData, cvicneTests: result.tests };
            }
            return result;
        }) : Promise.resolve(null);

        const odevzdavarnyPromise = (studium && userParams?.obdobi)
            ? syncOdevzdavarny(studium, userParams.obdobi).then(result => {
                if (result) {
                    cachedData = { ...cachedData, odevzdavarny: result.assignments };
                }
                return result;
            })
            : Promise.resolve(null);

        // Phase 2b: Full schedule + exams in parallel (subjects/studyPlan/studyStats re-uses already-started promises)
        // Start schedule fetch early so we can emit it the moment it resolves,
        // before waiting for the rest of the batch to settle.
        const earlyLastSync = Date.now();
        const schedulePromise = fetchFullSemesterSchedule().then((s) => {
            if (s) emitScheduleFirst(s as unknown[], earlyLastSync);
            return s;
        });
        const [fullSchedule, exams, subjects, studyPlan, studyStats, cvicneTests, odevzdavarnyResult, pastSubjects] = await Promise.allSettled([
            schedulePromise,
            fetchDualLanguageExams(),
            subjectsPromise,
            studyPlanPromise,
            studyStatsPromise,
            cvicneTestsPromise,
            odevzdavarnyPromise,
            pastSubjectsPromise,
        ]);

        if (
            subjects.status === "fulfilled" && subjects.value &&
            pastSubjects.status === "fulfilled" && pastSubjects.value
        ) {
            // Inject already-cached past semester subjects (richer data than dok_server)
            // before mergePastSubjects so dok_server only fills truly old subjects.
            if (studium && userParams?.obdobi && subjects.value.availablePeriods.length > 0) {
                const pastPeriods = subjects.value.availablePeriods.filter(p => p.id !== userParams!.obdobi);
                for (const period of pastPeriods) {
                    const cached = await IndexedDBService.get('meta', `past_semester_${period.id}`) as
                        { subjects: { data: typeof subjects.value.subjects.data }; attendance: unknown } | undefined;
                    if (cached?.subjects?.data) {
                        for (const [code, info] of Object.entries(cached.subjects.data)) {
                            if (!subjects.value.subjects.data[code]) {
                                subjects.value.subjects.data[code] = info;
                            }
                        }
                    }
                }
            }

            mergePastSubjects(
                subjects.value.subjects,
                pastSubjects.value,
                studyPlan.status === "fulfilled" ? studyPlan.value : null,
            );
        }

        cachedData = {
            ...cachedData,
            schedule: fullSchedule.status === "fulfilled" && fullSchedule.value ? fullSchedule.value : cachedData.schedule,
            exams: exams.status === "fulfilled" && exams.value.length > 0 ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" && subjects.value ? subjects.value.subjects : cachedData.subjects,
            attendance: subjects.status === "fulfilled" && subjects.value ? subjects.value.attendance : cachedData.attendance,
            studyPlan: studyPlan.status === "fulfilled" && studyPlan.value ? studyPlan.value : cachedData.studyPlan,
            studyStats: studyStats.status === "fulfilled" && studyStats.value ? studyStats.value : cachedData.studyStats,
            cvicneTests: cvicneTests.status === "fulfilled" && cvicneTests.value?.tests?.length ? cvicneTests.value.tests : cachedData.cvicneTests,
            odevzdavarny: odevzdavarnyResult.status === "fulfilled" && odevzdavarnyResult.value?.assignments?.length ? odevzdavarnyResult.value.assignments : cachedData.odevzdavarny,
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        // Push Phase 2 data (exams, schedule, subjects) to the iframe immediately,
        // before the slow per-subject Phase 3 (files, classmates, zazramnik).
        sendToIframe(Messages.syncUpdate({
            exams: cachedData.exams,
            schedule: cachedData.schedule,
            subjects: cachedData.subjects,
            attendance: cachedData.attendance,
            studyPlan: cachedData.studyPlan,
            studyStats: cachedData.studyStats,
            cvicneTests: cachedData.cvicneTests,
            odevzdavarny: cachedData.odevzdavarny,
            isSyncing: true,
            lastSync: cachedData.lastSync,
        }));

        if (subjects.status === "fulfilled" && subjects.value) {
            await syncSubjectDetails(subjects.value.subjects, fullSchedule.status === "fulfilled" ? fullSchedule.value : null);
        }

        
        cachedData.lastSync = Date.now();
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: false }));

        // Fire-and-forget: fetch past semesters once, permanently cache in IDB
        if (studium && userParams?.obdobi && subjects.status === "fulfilled" && subjects.value?.availablePeriods.length) {
            syncPastSemesters(studium, userParams.obdobi, subjects.value.availablePeriods).catch(() => {});
        }

        // Fire-and-forget: mirror current-semester files to Google Drive (only if linked).
        // Reuses the listings already fetched into cachedData.files — no extra IS crawling.
        runDriveBackupNow();
    } catch (e) {
        sendToIframe(Messages.syncUpdate({ isSyncing: false, error: String(e), lastSync: cachedData.lastSync }));
    } finally {
        isSyncing = false;
    }
}

/**
 * Mirror the current semester's already-fetched file listings to Google Drive.
 * Fire-and-forget from the periodic sync, and awaited directly when the user
 * connects (so the first backup starts immediately, without a full IS re-crawl).
 * No-op when nothing is cached yet — the next sync will pick it up.
 */
export async function runDriveBackupNow(): Promise<void> {
    try {
        const subjectsData = (cachedData.subjects as SubjectsData | undefined)?.data;
        const filesData = cachedData.files as Record<string, ParsedFile[]> | undefined;
        if (!currentSemesterCodes.length || !subjectsData || !filesData) return;
        const backupSubjects = currentSemesterCodes
            .map((code): DriveBackupSubject | null => {
                const info = subjectsData[code];
                const files = filesData[code];
                if (!info || !files?.length) return null;
                const folderName = `${code} - ${info.displayName || info.fullName || ''}`.trim();
                return { code, folderName, files };
            })
            .filter((s): s is DriveBackupSubject => s !== null);
        if (backupSubjects.length) await syncDriveBackup(backupSubjects);
        await runNotesBackupNow();
    } catch (e) {
        logError('Drive.backup', e);
    }
}

/** One notes-backup pass over the latest snapshot. Passes an empty list through
 *  too, so a subject whose notes were all deleted gets reconciled (emptied). */
async function notesBackupPass(): Promise<void> {
    if (!NOTES_ENABLED) return; // notes feature dormant — never back up to Drive
    try {
        const notes = cachedData.notes;
        if (!notes) return; // snapshot never pushed yet
        const subjectsData = (cachedData.subjects as SubjectsData | undefined)?.data;
        const subjectNotes: SubjectNotes[] = Object.entries(notes)
            .map(([code, fileMap]): SubjectNotes => {
                const files = Object.entries(fileMap).map(([fileLink, v]) => ({ fileLink, fileName: v.fileName, note: v.note }));
                const info = subjectsData?.[code];
                const folderName = info ? `${code} - ${info.displayName || info.fullName || ''}`.trim() : code;
                return { code, folderName, title: `Poznámky – ${code}`, files };
            });
        await syncDriveNotesBackup(subjectNotes, notesHtmlOverrides); // [] still reconciles manifest orphans
    } catch (e) {
        logError('Drive.notesBackup', e);
    }
}

/**
 * Mirror the iframe-pushed notes snapshot to per-subject Google Docs + sidecars.
 * Coalesced: never overlaps itself, and always runs once more for the latest
 * snapshot if a save arrived mid-pass.
 */
export const runNotesBackupNow: () => Promise<void> = singleFlight(notesBackupPass);

async function syncSubjectDetails(subjectsValue: { data: Record<string, { folderUrl?: string; subjectId?: string; skupinaId?: string }> }, scheduleValue: { studyId?: string; periodId?: string }[] | null) {
    const subjectEntries = Object.entries(subjectsValue.data);
    const userParams = await getUserParams();
    let studium = userParams?.studium;
    let obdobi = userParams?.obdobi;

    if (!studium || !obdobi) {
        const first = Array.isArray(scheduleValue) ? scheduleValue[0] : null;
        studium = studium || first?.studyId;
        obdobi = obdobi || first?.periodId;
    }

    // Phase 3a: Files + syllabus per subject (zaznamnik runs as a separate batched job below)
    const tasks = subjectEntries.map(([code, subject]) => limit(async () => {
        const subjectFull = subject as { folderUrl?: string; subjectId?: string };
        const subTasks = [];
        if (subjectFull.folderUrl) subTasks.push(fetchFilesFromFolder(subjectFull.folderUrl).then(f => { (cachedData.files as Record<string, unknown>)[code] = f; }).catch(() => {}));
        if (subjectFull.subjectId) subTasks.push(fetchSyllabus(subjectFull.subjectId).then(s => { if(!cachedData.syllabuses) cachedData.syllabuses = {}; (cachedData.syllabuses as Record<string, unknown>)[code] = s; }).catch(() => {}));
        await Promise.all(subTasks);
    }));

    // Zaznamnik batch — own pLimit(2), preserves prior values via merge guard in slice
    const zaznamnikPromise = (studium && obdobi)
        ? syncZaznamnik(studium, obdobi, subjectEntries.map(([courseCode, s]) => {
            const sf = s as { subjectId?: string; hasPrubezne?: boolean; hasTest?: boolean };
            return { courseCode, subjectId: sf.subjectId ?? '', hasPrubezne: sf.hasPrubezne, hasTest: sf.hasTest };
        })).then(z => { cachedData.zaznamnik = z; }).catch(() => {})
        : Promise.resolve();

    await Promise.all([...tasks, zaznamnikPromise]);

    // Phase 3b: Classmates — fetch skupina map once (predmetId→skupinaId),
    // then match to subjects by subjectId to get the right courseCode IDB key
    if (!studium || !obdobi) return;

    try {
        // predmetIdMap: { [predmetId]: skupinaId }
        let predmetIdMap: Record<string, string>;
        try {
            predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
        } catch {
            // First attempt failed — wait and retry once. Only report if the
            // retry also fails (caught by the outer try/catch below).
            await new Promise(r => setTimeout(r, 2000));
            predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
        }
        if (!cachedData.classmates) cachedData.classmates = {};

        // Build tasks by iterating enrolled subjects and matching their subjectId.
        // Per-subject failures are reported individually only when the group map
        // succeeded (root cause is then the per-subject fetch, not the map).
        const classmateTasks = subjectEntries
            .filter(([, subject]) => subject.subjectId && predmetIdMap[subject.subjectId])
            .map(([courseCode, subject]) => limit(async () => {
                const predmetId = subject.subjectId!;
                const skupinaId = predmetIdMap[predmetId];
                try {
                    const data = await fetchClassmates(predmetId, studium!, obdobi!, skupinaId);
                    await IndexedDBService.set('classmates', courseCode, data);
                    (cachedData.classmates as Record<string, unknown>)[courseCode] = data;
                    // Persist skupinaId for use in the UI if needed
                    subjectsValue.data[courseCode].skupinaId = skupinaId;
                } catch (e) {
                    sendToIframe(Messages.telemetryError('SyncService.syncClassmates', e));
                }
            }));

        await Promise.all(classmateTasks);
    } catch (e) {
        // Group-map fetch failed twice — single report for the root cause.
        // Per-subject classmate fetches are skipped (no map), so no cascade.
        sendToIframe(Messages.telemetryError('Sync.fetchSeminarGroupIds.retry', e));
    }
}

export function startSyncService() {
    syncAllData();
    syncIntervalId = setInterval(syncAllData, SYNC_INTERVAL);
}

export function stopSyncService() {
    if (syncIntervalId) clearInterval(syncIntervalId);
}

export async function refreshExams(): Promise<void> {
    const fresh = await fetchDualLanguageExams();
    if (fresh.length > 0) {
        cachedData = { ...cachedData, exams: fresh };
        sendToIframe(Messages.syncUpdate({ exams: fresh, isSyncing, lastSync: cachedData.lastSync }));
    }
}
