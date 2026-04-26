import { IskamAuthError } from './errors';

export const ISKAM_BASE = 'https://webiskam.mendelu.cz';

const LANG_COOKIE_PATH: Record<'cz' | 'en', string> = {
    cz: 'cs-CZ',
    en: 'en-US',
};

function isShibbolethRedirect(response: Response): boolean {
    return response.url.includes('alibaba.mendelu.cz') || response.url.includes('/idp/');
}

export async function fetchIskam(path: string, lang: 'cz' | 'en' = 'cz'): Promise<string> {
    // Double-encode the path to match what the WebISKAM server expects (%252f → decoded to %2f → decoded to /).
    const langPath = encodeURIComponent(encodeURIComponent(path));
    const langSwitch = `${ISKAM_BASE}/Localize/ChangeLang?changeLanguage=${langPath}&lang=${LANG_COOKIE_PATH[lang]}`;

    console.log(`[reIS:iskam] fetchIskam lang=${lang} path=${path}`);
    console.log(`[reIS:iskam] lang-switch URL → ${langSwitch}`);

    // Follow the redirect: ChangeLang sets the lang cookie and redirects to the page.
    // Capture the redirected response directly instead of doing a second fetch.
    const response = await fetch(langSwitch, { credentials: 'include' });
    console.log(`[reIS:iskam] response status=${response.status} finalUrl=${response.url}`);

    if (isShibbolethRedirect(response)) {
        console.warn(`[reIS:iskam] auth redirect detected → ${response.url}`);
        throw new IskamAuthError();
    }
    if (!response.ok) {
        throw new Error(`WebISKAM request failed: ${response.status}`);
    }
    const html = await response.text();
    if (html.includes('alibaba.mendelu.cz/idp')) {
        console.warn(`[reIS:iskam] auth redirect in HTML body`);
        throw new IskamAuthError();
    }
    console.log(`[reIS:iskam] fetchIskam OK lang=${lang} path=${path} htmlLen=${html.length}`);
    return html;
}

export async function requestIskam(path: string): Promise<string> {
    const response = await fetch(`${ISKAM_BASE}${path}`, { credentials: 'include' });
    if (isShibbolethRedirect(response)) {
        throw new IskamAuthError();
    }
    if (!response.ok) {
        throw new Error(`WebISKAM request failed: ${response.status}`);
    }
    const html = await response.text();
    if (html.includes('alibaba.mendelu.cz/idp')) {
        throw new IskamAuthError();
    }
    return html;
}
