const IFRAME_ID = 'reis-iskam-frame';

export let iskamIframeElement: HTMLIFrameElement | null = null;
let iskamIframeReady = false;
let iskamMessageQueue: unknown[] = [];

function injectIframe() {
    if (document.getElementById(IFRAME_ID)) return;

    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = chrome.runtime.getURL('reIS_logo.svg');
    document.head.appendChild(favicon);

    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(viewport);

    iskamIframeElement = document.createElement('iframe');
    iskamIframeElement.id = IFRAME_ID;
    iskamIframeElement.src = chrome.runtime.getURL('iskam.html');

    Object.assign(iskamIframeElement.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        border: 'none', margin: '0', padding: '0', overflow: 'hidden',
        zIndex: '2147483647', backgroundColor: '#f8fafc',
    });

    iskamIframeElement.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation');
    iskamIframeElement.setAttribute('allow', 'clipboard-write');

    document.body.appendChild(iskamIframeElement);
    document.body.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
}

export function markIskamIframeReady() {
    iskamIframeReady = true;
    if (iskamMessageQueue.length > 0 && iskamIframeElement?.contentWindow) {
        for (const msg of iskamMessageQueue) {
            iskamIframeElement.contentWindow.postMessage(msg, '*');
        }
    }
    iskamMessageQueue = [];
}

export function sendToIskamIframe(message: unknown) {
    if (!iskamIframeElement?.contentWindow) return;
    if (!iskamIframeReady) { iskamMessageQueue.push(message); return; }
    iskamIframeElement.contentWindow.postMessage(message, '*');
}

export function startIskamInjection() {
    injectIframe();
}
