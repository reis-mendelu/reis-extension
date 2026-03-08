import pLimit from "p-limit";
import { Messages } from "../types/messages";
import { fetchDualLanguageExams } from "../api/exams";
import { fetchDualLanguageSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchAssessments } from "../api/assessments";
import { fetchDualLanguageStudyPlan } from "../api/studyPlan";
import { fetchStudyStats } from "../api/studyStats";
import { fetchSyllabus } from "../api/syllabus";
import { fetchOsnovy } from "../api/osnovy";

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
            .then(subjects => {
                if (subjects) {
                    cachedData = { ...cachedData, subjects };
                    sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
                }
                return subjects;
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

        const osnovyPromise = studium ? fetchOsnovy(studium).then(osnovy => {
            if (osnovy) {
                cachedData = { ...cachedData, osnovy: osnovy.tests };
                IndexedDBService.set('osnovy', studium, osnovy.tests).catch(() => {});
            }
            return osnovy;
        }) : Promise.resolve(null);

        // Phase 2b: Full schedule + exams in parallel (subjects/studyPlan/studyStats re-uses already-started promises)
        const [fullSchedule, exams, subjects, studyPlan, studyStats, osnovy] = await Promise.allSettled([
            fetchFullSemesterSchedule(),
            fetchDualLanguageExams(),
            subjectsPromise,
            studyPlanPromise,
            studyStatsPromise,
            osnovyPromise,
        ]);

        cachedData = {
            ...cachedData,
            schedule: fullSchedule.status === "fulfilled" && fullSchedule.value ? fullSchedule.value : cachedData.schedule,
            exams: exams.status === "fulfilled" ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" ? subjects.value : cachedData.subjects,
            studyPlan: studyPlan.status === "fulfilled" && studyPlan.value ? studyPlan.value : cachedData.studyPlan,
            studyStats: studyStats.status === "fulfilled" && studyStats.value ? studyStats.value : cachedData.studyStats,
            osnovy: osnovy.status === "fulfilled" && osnovy.value ? osnovy.value.tests : cachedData.osnovy,
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        // Send full update with isPartial: false
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: false }));


        if (subjects.status === "fulfilled" && subjects.value) {
            await syncSubjectDetails(subjects.value, fullSchedule.status === "fulfilled" ? fullSchedule.value : null);
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

    const tasks = subjectEntries.map(([code, subject]) => limit(async () => {
        const subTasks = [];
        if (subject.folderUrl) subTasks.push(fetchFilesFromFolder(subject.folderUrl).then(f => { (cachedData.files as Record<string, unknown>)[code] = f; }).catch(() => {}));
        if (studium && obdobi && subject.subjectId) subTasks.push(fetchAssessments(studium, obdobi, subject.subjectId).then(a => { if(!cachedData.assessments) cachedData.assessments = {}; (cachedData.assessments as Record<string, unknown>)[code] = a; }).catch(() => {}));
        if (subject.subjectId) subTasks.push(fetchSyllabus(subject.subjectId).then(s => { if(!cachedData.syllabuses) cachedData.syllabuses = {}; (cachedData.syllabuses as Record<string, unknown>)[code] = s; }).catch(() => {}));
        await Promise.all(subTasks);
    }));

    await Promise.all(tasks);
}

export function startSyncService() {
    syncAllData();
    syncIntervalId = setInterval(syncAllData, SYNC_INTERVAL);
}

export function stopSyncService() {
    if (syncIntervalId) clearInterval(syncIntervalId);
}
