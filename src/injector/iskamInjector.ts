const IFRAME_ID = 'reis-iskam-frame';

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

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = chrome.runtime.getURL('iskam.html');

    Object.assign(iframe.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        border: 'none', margin: '0', padding: '0', overflow: 'hidden',
        zIndex: '2147483647', backgroundColor: '#f8fafc',
    });

    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation');
    iframe.setAttribute('allow', 'clipboard-write');

    document.body.appendChild(iframe);
    document.body.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
    document.documentElement.style.cssText = 'margin: 0; padding: 0; overflow: hidden;';
}

export function startIskamInjection() {
    // document.body is guaranteed to exist after document.open()/write()/close()
    // in the content script — no MutationObserver needed.
    injectIframe();
}
