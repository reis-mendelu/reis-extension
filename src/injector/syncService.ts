import pLimit from "p-limit";
import { Messages } from "../types/messages";
import { fetchDualLanguageExams } from "../api/exams";
import { fetchDualLanguageSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchAssessments } from "../api/assessments";
import { fetchDualLanguageStudyPlan } from "../api/studyPlan";
import { fetchStudyStats } from "../api/studyStats";
import { fetchSyllabus } from "../api/syllabus";
import { syncCvicneTests } from "../services/sync/syncCvicneTests";
import { syncOdevzdavarny } from "../services/sync/syncOdevzdavarny";
import { fetchSeminarGroupIds, fetchClassmates } from "../api/classmates";

import { getUserParams } from "../utils/userParams";
import { fetchScheduleBite, fetchFullSemesterSchedule } from "./dataFetchers";
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

        // Phase 1: Progressive "First Bite" - fetch (+/- 2 weeks) schedule first
        const scheduleBite = await fetchScheduleBite();
        if (scheduleBite) {
            cachedData.schedule = scheduleBite;
            // Send partial update immediately
            sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
        }

        // Phase 2a: Start subjects early — fast fetch, send immediately when ready
        const subjectsPromise = fetchDualLanguageSubjects(studium || undefined)
            .then(result => {
                if (result) {
                    cachedData = { ...cachedData, subjects: result.subjects, attendance: result.attendance };
                    sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
                }
                return result;
            });

        // Phase 2a-II: Fetch study plan + study stats concurrently with early subjects
        const studyPlanPromise = studium ? fetchDualLanguageStudyPlan(studium).then(plan => {
            if (plan) {
                cachedData = { ...cachedData, studyPlan: plan };
                sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
            }
            return plan;
        }) : Promise.resolve(null);

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
        const [fullSchedule, exams, subjects, studyPlan, studyStats, cvicneTests, odevzdavarnyResult] = await Promise.allSettled([
            fetchFullSemesterSchedule(),
            fetchDualLanguageExams(),
            subjectsPromise,
            studyPlanPromise,
            studyStatsPromise,
            cvicneTestsPromise,
            odevzdavarnyPromise,
        ]);

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
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        // Send full update with isPartial: false
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: false }));


        if (subjects.status === "fulfilled" && subjects.value) {
            await syncSubjectDetails(subjects.value.subjects, fullSchedule.status === "fulfilled" ? fullSchedule.value : null);
        }

        
        cachedData.lastSync = Date.now();
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: false }));
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

    // Phase 3a: Files, assessments, syllabus (existing)
    const tasks = subjectEntries.map(([code, subject]) => limit(async () => {
        const subTasks = [];
        if (subject.folderUrl) subTasks.push(fetchFilesFromFolder(subject.folderUrl).then(f => { (cachedData.files as Record<string, unknown>)[code] = f; }).catch(() => {}));
        if (studium && obdobi && subject.subjectId) subTasks.push(
            fetchAssessments(studium, obdobi, subject.subjectId)
                .then(a => { if (!cachedData.assessments) cachedData.assessments = {}; (cachedData.assessments as Record<string, unknown>)[code] = a; })
                .catch(() => {})
        );
        if (subject.subjectId) subTasks.push(fetchSyllabus(subject.subjectId).then(s => { if(!cachedData.syllabuses) cachedData.syllabuses = {}; (cachedData.syllabuses as Record<string, unknown>)[code] = s; }).catch(() => {}));
        await Promise.all(subTasks);
    }));

    await Promise.all(tasks);

    // Phase 3b: Classmates — fetch skupina map once (predmetId→skupinaId),
    // then match to subjects by subjectId to get the right courseCode IDB key
    if (!studium || !obdobi) return;

    try {
        // predmetIdMap: { [predmetId]: skupinaId }
        const predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
        if (!cachedData.classmates) cachedData.classmates = {};

        // Build tasks by iterating enrolled subjects and matching their subjectId
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
                    console.error(`[syncClassmates] Error for ${courseCode}:`, e);
                }
            }));

        await Promise.all(classmateTasks);
    } catch (e) {
        console.error('[syncClassmates] Error fetching group map:', e);
    }
}

export function startSyncService() {
    syncAllData();
    syncIntervalId = setInterval(syncAllData, SYNC_INTERVAL);
}

export function stopSyncService() {
    if (syncIntervalId) clearInterval(syncIntervalId);
}
