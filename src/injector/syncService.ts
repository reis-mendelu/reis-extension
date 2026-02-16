import pLimit from "p-limit";
import { Messages } from "../types/messages";
import { fetchDualLanguageExams } from "../api/exams";
import { fetchDualLanguageSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchAssessments } from "../api/assessments";
import { fetchSyllabus } from "../api/syllabus";
import { fetchSeminarGroupIds, fetchClassmates } from "../api/classmates";
import { getUserParams } from "../utils/userParams";
import { fetchScheduleBite, fetchFullSemesterSchedule } from "./dataFetchers";
import { sendToIframe } from "./iframeManager";
import { SYNC_INTERVAL } from "./config";
import type { SyncedData } from "../types/messages";

const limit = pLimit(3);
export let cachedData: SyncedData = { lastSync: 0 };
export let isSyncing = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export async function syncAllData() {
    console.log('[syncAllData] 🔄 Sync requested, isSyncing:', isSyncing);
    
    if (isSyncing) {
        console.log('[syncAllData] ⏳ Sync already in progress, skipping...');
        return;
    }
    
    isSyncing = true;
    sendToIframe(Messages.syncUpdate({ isSyncing: true, lastSync: cachedData.lastSync }));

    try {
        const userParams = await getUserParams();
        const studium = userParams?.studium;

        // Phase 1: Progressive "First Bite" - fetch (+/- 2 weeks) schedule first
        console.log('[syncAllData] 🥯 Phase 1: Fetching schedule bite...');
        const scheduleBite = await fetchScheduleBite();
        if (scheduleBite) {
            cachedData.schedule = scheduleBite;
            // Send partial update immediately
            sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
        }

        // Phase 2a: Start subjects early — fast fetch, send immediately when ready
        console.log('[syncAllData] 🍕 Phase 2a: Fetching subjects early...');
        const subjectsPromise = fetchDualLanguageSubjects(studium || undefined)
            .then(subjects => {
                if (subjects) {
                    cachedData = { ...cachedData, subjects };
                    sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: true }));
                    console.log('[syncAllData] ✅ Subjects ready, sent early update');
                }
                return subjects;
            });

        // Phase 2b: Full schedule + exams in parallel (subjects re-uses already-started promise)
        console.log('[syncAllData] 🍕 Phase 2b: Fetching full semester data...');
        const [fullSchedule, exams, subjects] = await Promise.allSettled([
            fetchFullSemesterSchedule(),
            fetchDualLanguageExams(),
            subjectsPromise,
        ]);

        cachedData = {
            ...cachedData,
            schedule: fullSchedule.status === "fulfilled" && fullSchedule.value ? fullSchedule.value : cachedData.schedule,
            exams: exams.status === "fulfilled" ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" ? subjects.value : cachedData.subjects,
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        // Send full update with isPartial: false
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true, isPartial: false }));


        if (subjects.status === "fulfilled" && subjects.value) {
            // Enrich subjects with seminar group IDs for classmates
            if (studium && userParams?.obdobi) {
                try {
                    const groupIds = await fetchSeminarGroupIds(studium, userParams.obdobi);
                    for (const [code, skupinaId] of Object.entries(groupIds)) {
                        if (subjects.value.data[code]) {
                            subjects.value.data[code].skupinaId = skupinaId;
                        }
                    }
                    cachedData.subjects = subjects.value;
                } catch (e) {
                    console.warn('[syncAllData] Failed to fetch seminar group IDs:', e);
                }
            }

            await syncSubjectDetails(subjects.value, fullSchedule.status === "fulfilled" ? fullSchedule.value : null);
        }

        
        cachedData.lastSync = Date.now();
        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: false }));
    } catch (e) {
        console.error("[REIS Content] Sync failed:", e);
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
        if (studium && obdobi && subject.subjectId && subject.skupinaId) subTasks.push(fetchClassmates(subject.subjectId, studium, obdobi, subject.skupinaId).then(c => { if(!cachedData.classmates) cachedData.classmates = {}; cachedData.classmates[code] = c; }).catch(() => {}));
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
