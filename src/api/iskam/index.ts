import { fetchKonta } from './konta';
import { fetchUbytovani } from './ubytovani';
import { fetchProfileAndPayments } from './profile';
import { fetchReservations } from './reservations';
import { fetchKontaTransactions } from './kontaTransactions';
import type { IskamData, KontoRow } from '../../types/iskam';

function mergeKontaLanguages(cz: KontoRow[], en: KontoRow[]): KontoRow[] {
    return cz.map((row, idx) => ({
        ...row,
        nameEn: en[idx]?.name ?? row.nameEn,
    }));
}

export async function fetchDualLanguageIskam(): Promise<IskamData> {
    // Sequential — lang-switch sets a session cookie, parallel requests race and corrupt each other.
    const czKonta = await fetchKonta('cz');
    const enKonta = await fetchKonta('en').catch(() => [] as KontoRow[]);
    const ubytovani = await fetchUbytovani('cz');
    const { profile, pendingPayments } = await fetchProfileAndPayments();
    const reservations = await fetchReservations();

    const stravKonto = czKonta.find(k => /stravov/i.test(k.name));
    const stravovaniTransactions = stravKonto?.transactionsHref
        ? await fetchKontaTransactions(stravKonto.transactionsHref).catch(() => [])
        : [];

    return {
        konta: enKonta.length === czKonta.length ? mergeKontaLanguages(czKonta, enKonta) : czKonta,
        ubytovani,
        profile: profile ?? undefined,
        reservations,
        pendingPayments,
        stravovaniTransactions,
        syncedAt: Date.now(),
    };
}

export { fetchKonta, fetchUbytovani, fetchProfileAndPayments, fetchReservations, fetchKontaTransactions };
export { IskamAuthError } from './errors';
