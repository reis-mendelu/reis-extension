import pLimit from "p-limit";
import { Messages } from "../types/messages";
import { fetchExamData } from "../api/exams";
import { fetchDualLanguageSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { fetchAssessments } from "../api/assessments";
import { fetchSyllabus } from "../api/syllabus";
import { getUserParams } from "../utils/userParams";
import { fetchScheduleData } from "./dataFetchers";
import { sendToIframe } from "./iframeManager";
import { SYNC_INTERVAL } from "./config";
import type { SyncedData } from "../types/messages";

const limit = pLimit(3);
export let cachedData: SyncedData = { lastSync: 0 };
let isSyncing = false;
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

        const [schedule, exams, subjects] = await Promise.allSettled([
            fetchScheduleData(),
 
            fetchExamData(), 
            fetchDualLanguageSubjects(studium || undefined),
        ]);

        cachedData = {
            ...cachedData,
            schedule: schedule.status === "fulfilled" ? schedule.value : cachedData.schedule,
            exams: exams.status === "fulfilled" ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" ? subjects.value : cachedData.subjects,
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: true }));

        if (subjects.status === "fulfilled" && subjects.value) {
            await syncSubjectDetails(subjects.value, schedule.status === "fulfilled" ? schedule.value : null);
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

async function syncSubjectDetails(subjectsValue: { data: Record<string, { folderUrl?: string; subjectId?: string }> }, scheduleValue: { studyId?: string; periodId?: string }[] | null) {
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
