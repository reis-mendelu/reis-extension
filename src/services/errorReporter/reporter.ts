// Automatic error reporter (PRIVACY.md §6).
// Listens for window 'error' and 'unhandledrejection' events, sanitizes the
// payload to exactly the seven disclosed fields, and POSTs via the
// `report_error` Supabase RPC. Fire-and-forget, deduped, capped per session.

import { supabase } from '../spolky/supabaseClient';
import {
    sanitizeMessage,
    sanitizeFilePath,
    getBrowserInfo,
    dedupeKey,
} from './sanitize';

const SESSION_CAP = 5;

let reportsSent = 0;
const seen = new Set<string>();

export function __resetReporterStateForTests(): void {
    reportsSent = 0;
    seen.clear();
}

function shouldSkipEnvironment(): boolean {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
    // Skip the WXT dev server but allow vitest (MODE === 'test') to exercise the path.
    if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') return true;
    return false;
}

function getExtVersion(): string {
    try {
        return chrome?.runtime?.getManifest?.().version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

interface NormalizedError {
    type: string;
    message: string;
    file: string;
    line: number;
}

function normalizeFromErrorEvent(ev: ErrorEvent): NormalizedError | null {
    const err = ev.error;
    const type = err?.name ?? 'Error';
    const rawMessage = err?.message ?? ev.message ?? '';
    const message = sanitizeMessage(rawMessage);
    if (!message) return null;
    return {
        type,
        message,
        file: sanitizeFilePath(ev.filename ?? ''),
        line: ev.lineno ?? 0,
    };
}

function normalizeFromRejection(ev: PromiseRejectionEvent): NormalizedError | null {
    const reason = ev.reason;
    let type = 'UnhandledRejection';
    let rawMessage: string;
    if (reason instanceof Error) {
        type = reason.name || 'Error';
        rawMessage = reason.message;
    } else if (typeof reason === 'string') {
        rawMessage = reason;
    } else {
        try { rawMessage = JSON.stringify(reason); } catch { rawMessage = String(reason); }
    }
    const message = sanitizeMessage(rawMessage);
    if (!message) return null;
    return { type, message, file: '', line: 0 };
}

function send(n: NormalizedError): void {
    const key = dedupeKey(n.type, n.message, n.file, n.line);
    if (seen.has(key)) return;
    seen.add(key);
    if (reportsSent >= SESSION_CAP) return;
    reportsSent++;

    const browser = getBrowserInfo();
    // Promise: exactly these seven fields. No spread, no extras.
    const payload = {
        p_error_type: n.type,
        p_error_message: n.message,
        p_file_path: n.file,
        p_line_number: n.line,
        p_ext_version: getExtVersion(),
        p_browser_name: browser.name,
        p_browser_version: browser.version,
    };
    void supabase.rpc('report_error', payload).then(() => {}, () => {});
}

export function installErrorReporter(getEnabled: () => boolean): () => void {
    const onError = (ev: ErrorEvent) => {
        if (!getEnabled() || shouldSkipEnvironment()) return;
        const n = normalizeFromErrorEvent(ev);
        if (n) send(n);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
        if (!getEnabled() || shouldSkipEnvironment()) return;
        const n = normalizeFromRejection(ev);
        if (n) send(n);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
    };
}
