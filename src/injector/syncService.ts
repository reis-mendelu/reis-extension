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
import { fetchBulletin } from "../api/bulletin";

import { getUserParams } from "../utils/userParams";
import { fetchFullSemesterSchedule } from "./dataFetchers";
import { sendToIframe } from "./iframeManager";
import { SYNC_INTERVAL } from "./config";
import type { SyncedData } from "../types/messages";
import { IndexedDBService } from "../services/storage/IndexedDBService";


const limit = pLimit(3);
export let cachedData: SyncedData = { lastSync: 0 };
export let isSyncing = false;
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

        // Phase 2a-III: Bulletin board — fast, independent fetch from IS main page
        const bulletinPromise = fetchBulletin().then(posts => {
            if (posts.length > 0) cachedData = { ...cachedData, bulletin: posts };
            return posts;
        }).catch(() => []);

        // Phase 2b: Full schedule + exams in parallel (subjects/studyPlan/studyStats re-uses already-started promises)
        const [fullSchedule, exams, subjects, studyPlan, studyStats, cvicneTests, odevzdavarnyResult, pastSubjects, bulletinResult] = await Promise.allSettled([
            fetchFullSemesterSchedule(),
            fetchDualLanguageExams(),
            subjectsPromise,
            studyPlanPromise,
            studyStatsPromise,
            cvicneTestsPromise,
            odevzdavarnyPromise,
            pastSubjectsPromise,
            bulletinPromise,
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
            exams: exams.status === "fulfilled" ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" && subjects.value ? subjects.value.subjects : cachedData.subjects,
            attendance: subjects.status === "fulfilled" && subjects.value ? subjects.value.attendance : cachedData.attendance,
            studyPlan: studyPlan.status === "fulfilled" && studyPlan.value ? studyPlan.value : cachedData.studyPlan,
            studyStats: studyStats.status === "fulfilled" && studyStats.value ? studyStats.value : cachedData.studyStats,
            cvicneTests: cvicneTests.status === "fulfilled" && cvicneTests.value?.tests?.length ? cvicneTests.value.tests : cachedData.cvicneTests,
            odevzdavarny: odevzdavarnyResult.status === "fulfilled" && odevzdavarnyResult.value?.assignments?.length ? odevzdavarnyResult.value.assignments : cachedData.odevzdavarny,
            bulletin: bulletinResult.status === "fulfilled" && bulletinResult.value?.length ? bulletinResult.value : cachedData.bulletin,
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
            bulletin: cachedData.bulletin,
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
    } catch (e) {
        sendToIframe(Messages.syncUpdate({ isSyncing: false, error: String(e), lastSync: cachedData.lastSync }));
    } finally { 
        isSyncing = false;
    }
}

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
