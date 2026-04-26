import { IskamAuthError } from '../api/iskam/errors';
import { fetchDualLanguageIskam } from '../api/iskam';
import { ISKAM_BASE } from '../api/iskam/client';
import { sendToIskamIframe } from './iskamInjector';
import { IskamMessages } from '../types/messages';
import type { IskamData } from '../types/iskam';

export let cachedIskamData: IskamData | null = null;
let isSyncingIskam = false;

export async function syncIskamData(): Promise<void> {
    if (isSyncingIskam) return;
    isSyncingIskam = true;
    console.log('[reIS:iskam] syncIskamData start');

    sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, true, null));

    try {
        const data = await fetchDualLanguageIskam();
        cachedIskamData = data;
        console.log('[reIS:iskam] syncIskamData success', data);
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(data, false, null));
    } catch (err) {
        if (err instanceof IskamAuthError) {
            // Session expired — navigate to the extension's entry page so WebISKAM
            // triggers Shibboleth and returns here after login.
            console.warn('[reIS:iskam] auth error, redirecting to ObjednavkyStravovani');
            window.location.href = `${ISKAM_BASE}/ObjednavkyStravovani`;
            return;
        }
        console.error('[reIS:iskam] syncIskamData network error', err);
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, false, 'network'));
    } finally {
        isSyncingIskam = false;
    }
}

export function startIskamSync(): void {
    syncIskamData();
}
