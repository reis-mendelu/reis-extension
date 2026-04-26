import { isIframeMessage } from '../types/messages';
import { iskamIframeElement, markIskamIframeReady } from './iskamInjector';

const IFRAME_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');

export async function handleIskamMessage(event: MessageEvent): Promise<void> {
    if (event.origin !== IFRAME_ORIGIN) return;
    if (event.source !== iskamIframeElement?.contentWindow) return;
    const data = event.data;
    if (!isIframeMessage(data)) return;

    if (data.type === 'ISKAM_READY') {
        // Flush queued messages (may include isSyncing:true and/or the final result).
        // The queue is sufficient — no guarantee message needed.
        markIskamIframeReady();
        return;
    }

    if (data.type === 'REIS_ACTION' && data.action === 'logout') {
        try {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/Prihlaseni/LogOut';
            document.body.appendChild(form);
            form.submit();
        } catch {
            // Best-effort logout
        }
    }
}
