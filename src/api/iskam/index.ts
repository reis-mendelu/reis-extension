import { fetchKonta } from './konta';
import { fetchUbytovani } from './ubytovani';
import { fetchProfileAndPayments } from './profile';
import { fetchReservations } from './reservations';
import { fetchKontaTransactions } from './kontaTransactions';
import type { IskamData, KontaTransaction, KontoRow } from '../../types/iskam';

const NON_FOOD_RE = [/^Ubytování/i, /^Tisky/i];

function czDatetimeToMs(dt: string): number {
    const [datePart, timePart = '00:00:00'] = dt.split(' ');
    const [d, m, y] = datePart.split('.');
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`).getTime();
}

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

    const [mainTxs, stravTxs] = await Promise.all([
        mainKonto?.transactionsHref
            ? fetchKontaTransactions(mainKonto.transactionsHref).catch(() => [])
            : Promise.resolve([]),
        stravKonto?.transactionsHref
            ? fetchKontaTransactions(stravKonto.transactionsHref).catch(() => [])
            : Promise.resolve([]),
    ]);

    // HLA needs non-food filtered out; STRAVOVACÍ is food-only but filter anyway for consistency.
    // datetime is Czech format "27.4.2026 12:48:02" — not lexicographically sortable, parse to ms.
    const foodTransactions = [...mainTxs.filter(isFoodTx), ...stravTxs.filter(isFoodTx)]
        .sort((a, b) => czDatetimeToMs(b.datetime) - czDatetimeToMs(a.datetime));

    const lastTopUpTx = [...mainTxs]
        .sort((a, b) => czDatetimeToMs(b.datetime) - czDatetimeToMs(a.datetime))
        .find(tx => tx.topUp !== null && tx.topUp > 0);

    return {
        konta: enKonta.length === czKonta.length ? mergeKontaLanguages(czKonta, enKonta) : czKonta,
        ubytovani,
        profile: profile ?? undefined,
        reservations,
        pendingPayments,
        foodTransactions,
        lastTopUp: lastTopUpTx?.topUp ?? null,
        syncedAt: Date.now(),
    };
}

export { fetchKonta, fetchUbytovani, fetchProfileAndPayments, fetchReservations, fetchKontaTransactions };
export { IskamAuthError } from './errors';
