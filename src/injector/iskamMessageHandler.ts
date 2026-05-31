import { isIframeMessage, Messages, IskamMessages } from '../types/messages';
import { iskamIframeElement, markIskamIframeReady, sendToIskamIframe } from './iskamInjector';
import { cachedIskamData, isSyncingIskam } from './iskamSyncService';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import { fetchVolneKapacityBlock } from '../api/iskam/volneKapacity';

const IFRAME_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '');

export async function handleIskamMessage(event: MessageEvent): Promise<void> {
    if (event.origin !== IFRAME_ORIGIN) return;
    if (event.source !== iskamIframeElement?.contentWindow) return;
    const data = event.data;
    if (!isIframeMessage(data)) return;

    if (data.type === 'ISKAM_READY') {
        // Flush queued messages (may include isSyncing:true and/or the final result),
        // then re-send the current cached state as a guarantee. A reloaded iframe
        // arrives after the queue was already drained, so without this re-seed it
        // would be stuck on its IDB cache (mirrors the IS-side REIS_READY handler).
        markIskamIframeReady();
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, isSyncingIskam, null));
        return;
    }

    if (data.type === 'ISKAM_FETCH_BLOCK') {
        const { id, blockId, od, doo } = data;
        fetchVolneKapacityBlock(blockId, od, doo)
            .then(rooms => {
                iskamIframeElement?.contentWindow?.postMessage({ type: 'ISKAM_BLOCK_RESULT', id, rooms }, IFRAME_ORIGIN);
            })
            .catch(err => {
                sendToIskamIframe(Messages.telemetryError('IskamMessageHandler.fetchBlock', err));
                iskamIframeElement?.contentWindow?.postMessage({ type: 'ISKAM_BLOCK_RESULT', id, rooms: [] }, IFRAME_ORIGIN);
            });
        return;
    }

    if (data.type === 'REIS_ACTION' && data.action === 'logout') {
        try {
            await IndexedDBService.clearAll();
        } catch (error) {
            sendToIskamIframe(Messages.telemetryError('IskamMessageHandler.logout:clearAll', error));
        }
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
