import { requestIskam } from './client';
import { parseProfile } from '../../utils/parsers/iskam/profile';
import { parsePendingPayments } from '../../utils/parsers/iskam/pendingPayments';
import type { IskamProfile, PendingPayment } from '../../types/iskam';

export async function fetchProfileAndPayments(): Promise<{ profile: IskamProfile | null; pendingPayments: PendingPayment[] }> {
    let html: string;
    try {
        html = await requestIskam('/InformaceOKlientovi');
    } catch (e) {
        console.warn('[reIS:iskam] fetchProfileAndPayments network failed', e);
        return { profile: null, pendingPayments: [] };
    }

    let profile: IskamProfile | null = null;
    try { profile = parseProfile(html); } catch (e) { console.warn('[reIS:iskam] parseProfile failed', e); }

    let pendingPayments: PendingPayment[] = [];
    try { pendingPayments = parsePendingPayments(html); } catch (e) { console.warn('[reIS:iskam] parsePendingPayments failed', e); }

    return { profile, pendingPayments };
}
