import { Messages, isIframeMessage } from "../types/messages";
import { iframeElement, sendToIframe } from "./iframeManager";
import { cachedData, syncAllData } from "./syncService";
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
            if (cachedData.lastSync > 0) sendToIframe(Messages.syncUpdate(cachedData));
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

async function handleDataRequest(dataType: DataRequestType) {
    try {
        if (dataType === "all") {
            if (cachedData.lastSync === 0) await syncAllData();
            sendToIframe(Messages.data("all", cachedData));
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

async function handleFetchRequest(id: string, url: string, options?: any) {
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

async function handleAction(id: string, action: string, payload: any) {
    try {
        let result: any = null;
        switch (action) {
            case "register_exam": result = { success: await registerExam(payload.termId) }; break;
            case "unregister_exam": result = { success: await unregisterExam(payload.termId) }; break;
            case "trigger_sync": await syncAllData(); result = { success: true }; break;
            default: throw new Error(`Unknown action: ${action}`);
        }
        sendToIframe(Messages.actionResult(id, true, result));
    } catch (e) { sendToIframe(Messages.actionResult(id, false, undefined, String(e))); }
}
