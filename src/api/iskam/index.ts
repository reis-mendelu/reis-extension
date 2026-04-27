import { fetchKonta } from './konta';
import { fetchUbytovani } from './ubytovani';
import { fetchProfileAndPayments } from './profile';
import { fetchReservations } from './reservations';
import { fetchKontaTransactions } from './kontaTransactions';
import type { IskamData, KontaTransaction, KontoRow } from '../../types/iskam';

const NON_FOOD_RE = [/^Ubytování/i, /^Tisky/i];

function isFoodTx(tx: KontaTransaction): boolean {
    return tx.type === 'Úhrada' && !NON_FOOD_RE.some(re => re.test(tx.description));
}

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

    const mainKonto = czKonta.find(k => /hlavní|main/i.test(k.name));
    const stravKonto = czKonta.find(k => /stravov/i.test(k.name));

    const mainTxs = mainKonto?.transactionsHref
        ? await fetchKontaTransactions(mainKonto.transactionsHref).catch(() => [])
        : [];
    const stravTxs = stravKonto?.transactionsHref
        ? await fetchKontaTransactions(stravKonto.transactionsHref).catch(() => [])
        : [];

    // HLA needs non-food filtered out; STRAVOVACÍ is food-only but filter anyway for consistency.
    // Sort merged result newest-first by datetime string (ISO-ish, same locale so lexicographic works after parsing).
    const foodTransactions = [...mainTxs.filter(isFoodTx), ...stravTxs.filter(isFoodTx)]
        .sort((a, b) => b.datetime.localeCompare(a.datetime));

    return {
        konta: enKonta.length === czKonta.length ? mergeKontaLanguages(czKonta, enKonta) : czKonta,
        ubytovani,
        profile: profile ?? undefined,
        reservations,
        pendingPayments,
        foodTransactions,
        syncedAt: Date.now(),
    };
}

export { fetchKonta, fetchUbytovani, fetchProfileAndPayments, fetchReservations, fetchKontaTransactions };
export { IskamAuthError } from './errors';
