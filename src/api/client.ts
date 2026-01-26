/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { fetchViaProxy, isInIframe } from './proxyClient';

export const BASE_URL = "https://is.mendelu.cz";

export const DEFAULT_HEADERS: Record<string, string> = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
    "cache-control": "max-age=0",
    "content-type": "application/x-www-form-urlencoded",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1"
};

/**
 * Fetch with authentication, automatically routes through proxy when in iframe.
 * 
 * - Content Script context: Direct fetch with cookies
 * - Iframe context: Proxied through content script via postMessage
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = { ...DEFAULT_HEADERS, ...options.headers as Record<string, string> };

    // If we're in an iframe, use the proxy client
    if (isInIframe()) {
        console.debug('[fetchWithAuth] Using proxy (iframe context)');

        const text = await fetchViaProxy(url, {
            method: options.method as string | undefined,
            headers,
            body: options.body as string | undefined,
        });

        // Create a Response-like object from the text
        return new Response(text, {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/html' })
        });
    }

    // Direct fetch in content script context
    console.debug('[fetchWithAuth] Using direct fetch (content script context)');

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
        mode: "cors",
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            window.location.href = "https://is.mendelu.cz/system/login.pl?lang=cz";
            throw new Error("Authentication required");
        }
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response;
}
