import { requestIskam } from './client';
import { parseProfile } from '../../utils/parsers/iskam/profile';
import { parsePendingPayments } from '../../utils/parsers/iskam/pendingPayments';
import type { IskamProfile, PendingPayment } from '../../types/iskam';

export async function fetchProfileAndPayments(): Promise<{ profile: IskamProfile | null; pendingPayments: PendingPayment[] }> {
    try {
        const html = await requestIskam('/InformaceOKlientovi');
        return { profile: parseProfile(html), pendingPayments: parsePendingPayments(html) };
    } catch (e) {
        console.warn('[reIS:iskam] fetchProfile failed', e);
        return { profile: null, pendingPayments: [] };
    }
}
