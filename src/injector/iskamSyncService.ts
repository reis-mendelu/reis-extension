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

    sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, true, null));

    try {
        const data = await fetchDualLanguageIskam();
        cachedIskamData = data;
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(data, false, null));
    } catch (err) {
        if (err instanceof IskamAuthError) {
            window.location.href = `${ISKAM_BASE}/ObjednavkyStravovani`;
            return;
        }
        console.error('[reIS:iskam] sync error', err);
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, false, 'network'));
    } finally {
        isSyncingIskam = false;
    }
}

export function startIskamSync(): void {
    syncIskamData();
}
