import { syncAllData } from './syncService';

export const BG_POKE_MESSAGE = 'REIS_BG_POKE';

/**
 * Register the content-script listener for the periodic alarm fired by the
 * background service worker. syncAllData is idempotent under its isSyncing
 * guard, so a poke during an active sync is a safe no-op.
 */
export function startBgPokeListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== BG_POKE_MESSAGE) return false;
        syncAllData().catch(() => {});
        sendResponse({ ok: true });
        return false;
    });
}
