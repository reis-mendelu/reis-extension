import { IFRAME_ID } from './config';
import { injectIframe } from './iframeManager';
import { handleMessage } from './messageHandler';
import { startSyncService } from './syncService';

export function startInjection() {
    if (document.body) {
        injectAndInitialize();
    } else {
        const observer = new MutationObserver((_mutations, obs) => {
            if (document.body) {
                obs.disconnect();
                injectAndInitialize();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
}

function injectAndInitialize() {
    if (document.getElementById(IFRAME_ID)) return;
    if (document.body?.innerHTML.includes("/system/login.pl")) {
        document.documentElement.style.visibility = "visible";
        return;
    }
    injectIframe();
    window.addEventListener("message", handleMessage);
    startSyncService();
}
