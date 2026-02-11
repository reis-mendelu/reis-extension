import { IFRAME_ID } from './config';

export let iframeElement: HTMLIFrameElement | null = null;

export function injectIframe() {
    console.log("[REIS Content] Injecting iframe...");
    document.body.replaceChildren();
    document.head.replaceChildren();

    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = chrome.runtime.getURL("mendelu_logo_128.png");
    document.head.appendChild(favicon);

    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = chrome.runtime.getURL("fonts/inter.css");
    document.head.appendChild(fontLink);

    iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("main.html");

    Object.assign(iframeElement.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        border: "none", margin: "0", padding: "0", overflow: "hidden",
        zIndex: "2147483647", backgroundColor: "#f8fafc",
    });

    iframeElement.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
    iframeElement.setAttribute("allow", "clipboard-write");

    document.body.appendChild(iframeElement);
    document.body.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.visibility = "visible";
    console.log("[REIS Content] Iframe injected successfully");
}

export function sendToIframe(message: unknown) {
    if (!iframeElement?.contentWindow) return;
    iframeElement.contentWindow.postMessage(message, "*");
}
