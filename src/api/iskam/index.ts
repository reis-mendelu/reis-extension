import { fetchKonta } from './konta';
import { fetchUbytovani } from './ubytovani';
import { fetchProfile } from './profile';
import { fetchReservations } from './reservations';
import type { IskamData, KontoRow } from '../../types/iskam';

function mergeKontaLanguages(cz: KontoRow[], en: KontoRow[]): KontoRow[] {
    return cz.map((row, idx) => ({
        ...row,
        nameEn: en[idx]?.name ?? row.nameEn,
    }));
}

export async function fetchDualLanguageIskam(): Promise<IskamData> {
    console.log('[reIS:iskam] fetchDualLanguageIskam start');

    // Sequential — lang-switch sets a session cookie, parallel requests race and corrupt each other.
    const czKonta = await fetchKonta('cz');
    const enKonta = await fetchKonta('en').catch((e) => { console.warn('[reIS:iskam] fetchKonta(en) failed', e); return [] as KontoRow[]; });
    const ubytovani = await fetchUbytovani('cz');
    const profile = await fetchProfile();
    const reservations = await fetchReservations();

    console.log(`[reIS:iskam] czKonta=${czKonta.length} enKonta=${enKonta.length} ubytovani=${ubytovani.length} profile=${!!profile} reservations=${reservations.length}`);

    return {
        konta: enKonta.length === czKonta.length ? mergeKontaLanguages(czKonta, enKonta) : czKonta,
        ubytovani,
        profile: profile ?? undefined,
        reservations,
        syncedAt: Date.now(),
    };
}

export { fetchKonta, fetchUbytovani, fetchProfile, fetchReservations };
export { IskamAuthError } from './errors';
