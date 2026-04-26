import { IskamAuthError } from '../api/iskam/errors';
import { fetchDualLanguageIskam } from '../api/iskam';
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
        const error = err instanceof IskamAuthError ? 'auth' : 'network';
        console.error(`[reIS:iskam] syncIskamData error=${error}`, err);
        sendToIskamIframe(IskamMessages.iskamSyncUpdate(cachedIskamData, false, error));
    } finally {
        isSyncingIskam = false;
    }
}

export function startIskamSync(): void {
    syncIskamData();
}
