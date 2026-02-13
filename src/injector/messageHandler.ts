import { Messages, isIframeMessage } from "../types/messages";
import { iframeElement, sendToIframe } from "./iframeManager";
import { cachedData, syncAllData, isSyncing } from "./syncService";
import { fetchScheduleData } from "./dataFetchers";
import { fetchExamData, registerExam, unregisterExam } from "../api/exams";
import { fetchSubjects } from "../api/subjects";
import type { DataRequestType } from "../types/messages";

export async function handleMessage(event: MessageEvent) {
    if (event.source !== iframeElement?.contentWindow) return;
    const data = event.data;
    if (!isIframeMessage(data)) return;

    switch (data.type) {
        case "REIS_READY":
            sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing }));
            break;
        case "REIS_REQUEST_DATA":
            await handleDataRequest(data.dataType);
            break;
        case "REIS_FETCH":
            await handleFetchRequest(data.id, data.url, data.options);
            break;
        case "REIS_ACTION":
            console.log('[messageHandler] 📨 Received action:', data.action, 'with payload:', data.payload);
            await handleAction(data.id, data.action, data.payload);
            break;
    }
}

async function handleDataRequest(dataType: DataRequestType) {
    try {
        if (dataType === "all") {
            if (cachedData.lastSync === 0) await syncAllData();
            sendToIframe(Messages.data("all", { ...cachedData, isSyncing }));
        } else {
            let data: unknown = null;
            switch (dataType) {
                case "schedule": data = await fetchScheduleData(); break;
                case "exams": data = await fetchExamData(); break;
                case "subjects": data = await fetchSubjects(); break;
                case "files": data = cachedData.files; break;
            }
            sendToIframe(Messages.data(dataType, data));
        }
    } catch (e) { sendToIframe(Messages.data(dataType, null, String(e))); }
}

async function handleFetchRequest(id: string, url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
    try {
        const response = await fetch(url, {
            method: options?.method ?? "GET", headers: options?.headers,
            body: options?.body, credentials: "include",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        sendToIframe(Messages.fetchResult(id, true, text));
    } catch (e) { sendToIframe(Messages.fetchResult(id, false, undefined, String(e))); }
}

async function handleAction(id: string, action: string, payload: unknown) {
    console.log('[handleAction] 🎯 Processing action:', action);
    try {
        let result: unknown = null;
        const p = payload as Record<string, string>;
        switch (action) {
            case "register_exam": result = { success: await registerExam(p.termId) }; break;
            case "unregister_exam": result = { success: await unregisterExam(p.termId) }; break;
            case "trigger_sync": 
                console.log('[handleAction] 🔄 Triggering sync...');
                await syncAllData(); 
                console.log('[handleAction] ✅ Sync completed');
                result = { success: true }; 
                break;
            default: throw new Error(`Unknown action: ${action}`);
        }
        sendToIframe(Messages.actionResult(id, true, result));
    } catch (e) { 
        console.error('[handleAction] ❌ Action failed:', e);
        sendToIframe(Messages.actionResult(id, false, undefined, String(e))); 
    }
}
