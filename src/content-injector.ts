/**
 * Content Script Injector for REIS Chrome Extension
 *
 * This script runs on is.mendelu.cz and:
 * 1. Injects an iframe containing the React app
 * 2. Handles postMessage communication with the iframe
 * 3. Proxies authenticated fetch requests for the iframe
 * 4. Runs the SyncService to push data updates to the iframe
 *
 * Architecture:
 * - Host Page (is.mendelu.cz) → Content Script → Iframe (chrome-extension://...)
 * - Content Script has access to cookies, iframe has isolated CSS
 */

import type {
    ContentToIframeMessage,
    DataRequestType,
    SyncedData,
} from "./types/messages";
import { Messages, isIframeMessage } from "./types/messages";

// =============================================================================
// Configuration
// =============================================================================

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const IFRAME_ID = "reis-app-frame";

// API imports for data fetching (these work because content script has cookie access)
import { fetchWeekSchedule } from "./api/schedule";
import { fetchExamData } from "./api/exams";
import { fetchSubjects } from "./api/subjects";
import { fetchFilesFromFolder } from "./api/documents";
import { fetchAssessments } from "./api/assessments";
import { fetchSyllabus } from "./api/syllabus";
import { registerExam, unregisterExam } from "./api/exams";
import { getUserParams } from "./utils/userParams";
import { fetchStudyProgram } from "./api/studyProgram";
import pLimit from "p-limit";

import type { SubjectsData } from "./types/documents";

// =============================================================================
// State
// =============================================================================

let iframeElement: HTMLIFrameElement | null = null;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let cachedData: SyncedData = { lastSync: 0 };

// Create a limiter for network operations (limit 3)
const limit = pLimit(3);

// =============================================================================
// DOM Sniper Pattern - Earliest Possible Iframe Injection
// =============================================================================

console.log("[REIS Content] Script loaded (document_start)");

// Hide page immediately to prevent flash of university content
if (document.documentElement) {
    document.documentElement.style.visibility = "hidden";
}

// The main injection function
function injectAndInitialize() {
    // Avoid double injection
    if (document.getElementById(IFRAME_ID)) {
        console.log("[REIS Content] Iframe already exists, skipping");
        return;
    }

    // Check for login page
    if (document.body?.innerHTML.includes("/system/login.pl")) {
        console.log("[REIS Content] Login page detected, showing original page");
        document.documentElement.style.visibility = "visible";
        return;
    }

    console.log("[REIS Content] Injecting iframe...");

    // Inject the iframe
    injectIframe();

    // Set up message listener
    window.addEventListener("message", handleMessage);

    // Start sync service
    startSyncService();
}

// DOM Sniper Logic - Watch for <body> to appear
function startInjection() {
    if (document.body) {
        console.log("[REIS Content] Body exists, injecting immediately");
        injectAndInitialize();
    } else {
        console.log("[REIS Content] Waiting for body via MutationObserver...");
        const observer = new MutationObserver((_mutations, obs) => {
            if (document.body) {
                console.log("[REIS Content] Body appeared, injecting now");
                obs.disconnect();
                injectAndInitialize();
            }
        });

        observer.observe(document.documentElement, { childList: true });
    }
}

// Start the sniper immediately
startInjection();

// =============================================================================
// Iframe Injection
// =============================================================================

function injectIframe() {
    console.log("[REIS Content] Injecting iframe...");

    // Clear existing content
    document.body.replaceChildren();
    document.head.replaceChildren();

    // Inject favicon
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = chrome.runtime.getURL("mendelu_logo_128.png");
    document.head.appendChild(favicon);

    // Inject Inter font
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = chrome.runtime.getURL("fonts/inter.css");
    document.head.appendChild(fontLink);

    // Create iframe
    iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("index.html");

    // Fullscreen styling
    Object.assign(iframeElement.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        border: "none",
        margin: "0",
        padding: "0",
        overflow: "hidden",
        zIndex: "2147483647",
        backgroundColor: "#f8fafc",
    });

    iframeElement.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
    );
    iframeElement.setAttribute("allow", "clipboard-write");

    document.body.appendChild(iframeElement);

    document.body.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.cssText = "margin: 0; padding: 0; overflow: hidden;";

    document.documentElement.style.visibility = "visible";

    console.log("[REIS Content] Iframe injected successfully");
}

// =============================================================================
// Message Handling
// =============================================================================

async function handleMessage(event: MessageEvent) {
    if (event.source !== iframeElement?.contentWindow) {
        return;
    }

    const data = event.data;

    if (!isIframeMessage(data)) {
        return;
    }

    console.debug("[REIS Content] Received message:", data.type);

    switch (data.type) {
        case "REIS_READY":
            handleReady();
            break;

        case "REIS_REQUEST_DATA":
            await handleDataRequest(data.dataType);
            break;

        case "REIS_FETCH":
            await handleFetchRequest(data.id, data.url, data.options);
            break;

        case "REIS_ACTION":
            await handleAction(data.id, data.action, data.payload);
            break;
    }
}

function handleReady() {
    console.log("[REIS Content] Iframe is ready");
    if (cachedData.lastSync > 0) {
        sendToIframe(Messages.syncUpdate(cachedData));
    }
}

async function handleDataRequest(dataType: DataRequestType) {
    console.log("[REIS Content] Data request:", dataType);

    try {
        if (dataType === "all") {
            if (cachedData.lastSync === 0) {
                await syncAllData();
            }
            sendToIframe(Messages.data("all", cachedData));
        } else {
            let data: unknown = null;
            switch (dataType) {
                case "schedule":
                    data = await fetchScheduleData();
                    break;
                case "exams":
                    data = await fetchExamData();
                    break;
                case "subjects":
                    data = await fetchSubjects();
                    break;
                case "files":
                    data = cachedData.files;
                    break;
            }
            sendToIframe(Messages.data(dataType, data));
        }
    } catch (error) {
        console.error("[REIS Content] Data request failed:", error);
        sendToIframe(Messages.data(dataType, null, String(error)));
    }
}

async function handleFetchRequest(
    id: string,
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: string }
) {
    try {
        const response = await fetch(url, {
            method: options?.method ?? "GET",
            headers: options?.headers,
            body: options?.body,
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        sendToIframe(Messages.fetchResult(id, true, text));
    } catch (error) {
        console.error("[REIS Content] Fetch proxy error:", error);
        sendToIframe(Messages.fetchResult(id, false, undefined, String(error)));
    }
}

async function handleAction(id: string, action: string, payload: unknown) {
    try {
        let result: unknown = null;
        switch (action) {
            case "register_exam": {
                const termId = (payload as { termId: string }).termId;
                const success = await registerExam(termId);
                result = { success };
                break;
            }
            case "unregister_exam": {
                const termId = (payload as { termId: string }).termId;
                const success = await unregisterExam(termId);
                result = { success };
                break;
            }
            case "trigger_sync": {
                await syncAllData();
                result = { success: true };
                break;
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        sendToIframe(Messages.actionResult(id, true, result));
    } catch (error) {
        console.error("[REIS Content] Action error:", error);
        sendToIframe(Messages.actionResult(id, false, undefined, String(error)));
    }
}

function sendToIframe(message: ContentToIframeMessage) {
    if (!iframeElement?.contentWindow) {
        return;
    }
    iframeElement.contentWindow.postMessage(message, "*");
}

// =============================================================================
// Sync Service
// =============================================================================

function startSyncService() {
    console.log("[REIS Content] Starting sync service...");
    syncAllData();
    syncIntervalId = setInterval(() => {
        syncAllData();
    }, SYNC_INTERVAL);
}

async function syncAllData() {
    console.log("[REIS Content] 🔄 Starting scraping/sync process...");
    console.log("[REIS Content] Syncing all data...");

    try {
        const [schedule, exams, subjects] = await Promise.allSettled([
            fetchScheduleData(),
            fetchExamData(),
            fetchSubjects(),
        ]);

        cachedData = {
            ...cachedData,
            schedule: schedule.status === "fulfilled" ? schedule.value : cachedData.schedule,
            exams: exams.status === "fulfilled" ? exams.value : cachedData.exams,
            subjects: subjects.status === "fulfilled" ? subjects.value : cachedData.subjects,
            files: cachedData.files || {},
            lastSync: Date.now(),
        };

        // Notify iframe about basic data immediately
        sendToIframe(Messages.syncUpdate(cachedData));

        if (subjects.status === "fulfilled" && subjects.value) {
            const subjectsData = subjects.value as SubjectsData;
            const subjectEntries = Object.entries(subjectsData.data);

            // Get user params for assessment sync
            const userParams = await getUserParams();
            let studium = userParams?.studium;
            let obdobi = userParams?.obdobi;

            // Fallback: Try to get from schedule data if missing
            if (!studium || !obdobi) {
                console.log('[REIS Content] Incomplete user params, trying fallback from schedule data...');
                const scheduleArray = (schedule.status === "fulfilled" && Array.isArray(schedule.value)) ? schedule.value : null;
                if (scheduleArray && scheduleArray.length > 0) {
                    const firstEvent = scheduleArray[0] as any;
                    studium = studium || (firstEvent.studyId);
                    obdobi = obdobi || (firstEvent.periodId);
                    console.log(`[REIS Content] Fallback successful: studium=${studium}, obdobi=${obdobi}`);
                }
            }
            
            console.log(`[REIS Content] Starting batched sync for ${subjectEntries.length} subjects. Concurrency=3`);

            const subjectTasks = subjectEntries.map(([courseCode, subject]) => {
                return limit(async () => {
                    console.log(`[REIS Content] Processing ${courseCode}: subjectId=${subject.subjectId}`);
                    
                    const subTasks = [];

                    // Fetch files
                    if (subject.folderUrl) {
                        subTasks.push((async () => {
                            try {
                                const subjectFiles = await fetchFilesFromFolder(subject.folderUrl);
                                // Update cachedData
                                if (!cachedData.files) cachedData.files = {};
                                const filesMap = cachedData.files as Record<string, any>;
                                filesMap[courseCode] = subjectFiles;
                            } catch (e) {
                                console.warn(`[REIS Content] Failed to fetch files for ${courseCode}:`, e);
                            }
                        })());
                    }

                    // Fetch assessments
                    if (studium && obdobi && subject.subjectId) {
                        subTasks.push((async () => {
                            try {
                                const subjectAssessments = await fetchAssessments(studium, obdobi, subject.subjectId as string);
                                // Update cachedData
                                if (!cachedData.assessments) cachedData.assessments = {};
                                const assessmentsMap = cachedData.assessments as Record<string, any>;
                                assessmentsMap[courseCode] = subjectAssessments;
                            } catch (e) {
                                console.warn(`[REIS Content] Failed to fetch assessments for ${courseCode}:`, e);
                            }
                        })());
                    }
                    
                    // Fetch syllabus
                    if (subject.subjectId) {
                        subTasks.push((async () => {
                            try {
                                const subjectSyllabus = await fetchSyllabus(subject.subjectId as string);
                                // Update cachedData
                                if (!cachedData.syllabuses) cachedData.syllabuses = {};
                                const syllabusesMap = cachedData.syllabuses as Record<string, any>;
                                syllabusesMap[courseCode] = subjectSyllabus;
                            } catch (e) {
                                console.warn(`[REIS Content] Failed to fetch syllabus for ${courseCode}:`, e);
                            }
                        })());
                    }

                    await Promise.all(subTasks);
                });
            });

            // Sync Study Program (Independent / Parallel)
            limit(async () => {
                try {
                    console.log("[REIS Content] 🔍 Starting Study Program fetch (Independent)...");
                    const programData = await fetchStudyProgram();
                    
                    if (programData) {
                        console.log(`[REIS Content] ✅ Study Program fetched. Programs: ${programData.programs.length}, Rows: ${programData.finalTable.length}`);
                        // Update cache
                        cachedData.studyProgram = programData;
                        // Send IMMEDIATE update for this specific data
                        sendToIframe(Messages.syncUpdate({
                            studyProgram: programData,
                            lastSync: Date.now()
                        }));
                    } else {
                        console.warn("[REIS Content] ⚠️ fetchStudyProgram returned null");
                    }
                } catch (e) {
                    console.error("[REIS Content] ❌ Failed to sync study program:", e);
                }
            });

            await Promise.all(subjectTasks);
            
            console.log("[REIS Content] ✅ All subject details synced (ready to send)");
            
            // Final update
            cachedData.lastSync = Date.now();
            console.log("[REIS Content] 📤 Sending sync update to iframe. Has studyProgram?", !!cachedData.studyProgram);
            sendToIframe(Messages.syncUpdate(cachedData));
        }
    } catch (error) {
        console.error("[REIS Content] Sync failed:", error);
        cachedData.error = String(error);
    }
}

async function fetchScheduleData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let start: Date;
    let end: Date;

    if (currentMonth >= 8) {
        start = new Date(currentYear, 8, 1);
        end = new Date(currentYear + 1, 1, 28);
    } else if (currentMonth <= 1) {
        start = new Date(currentYear - 1, 8, 1);
        end = new Date(currentYear, 1, 28);
    } else {
        start = new Date(currentYear, 1, 1);
        end = new Date(currentYear, 7, 31);
    }

    return fetchWeekSchedule({ start, end });
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
        }
        window.removeEventListener("message", handleMessage);
    });
}
