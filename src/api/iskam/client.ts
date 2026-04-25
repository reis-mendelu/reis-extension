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
    const url = `${ISKAM_BASE}${path}`;
    const langPath = encodeURIComponent(path);
    const langSwitch = `${ISKAM_BASE}/Localize/ChangeLang?changeLanguage=${langPath}&lang=${LANG_COOKIE_PATH[lang]}`;

    await fetch(langSwitch, { credentials: 'include' }).catch(() => undefined);

    const response = await fetch(url, { credentials: 'include' });
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
