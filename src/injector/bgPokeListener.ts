import { requestSync } from './syncGate';

export const BG_POKE_MESSAGE = 'REIS_BG_POKE';

/**
 * Register the content-script listener for the periodic alarm fired by the
 * background service worker.
 *
 * The alarm pokes EVERY open is.mendelu.cz tab, so this used to mean one full
 * crawl per tab per alarm. `requestSync` drops the poke when the tab is in the
 * background, when a run happened recently, or when another tab already holds
 * the sync lock.
 */
export function startBgPokeListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== BG_POKE_MESSAGE) return false;
        void requestSync('poke');
        sendResponse({ ok: true });
        return false;
    });
}
