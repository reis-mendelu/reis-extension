import { fetchKonta } from './konta';
import { fetchUbytovani } from './ubytovani';
import type { IskamData, KontoRow } from '../../types/iskam';

function mergeKontaLanguages(cz: KontoRow[], en: KontoRow[]): KontoRow[] {
    return cz.map((row, idx) => ({
        ...row,
        nameEn: en[idx]?.name ?? row.nameEn,
    }));
}

export async function fetchDualLanguageIskam(): Promise<IskamData> {
    const [czKonta, enKonta, ubytovani] = await Promise.all([
        fetchKonta('cz'),
        fetchKonta('en').catch(() => [] as KontoRow[]),
        fetchUbytovani('cz'),
    ]);

    return {
        konta: enKonta.length === czKonta.length ? mergeKontaLanguages(czKonta, enKonta) : czKonta,
        ubytovani,
        syncedAt: Date.now(),
    };
}

export { fetchKonta, fetchUbytovani };
export { IskamAuthError } from './errors';
