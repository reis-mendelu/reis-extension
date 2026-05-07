import { requestIskam } from './client';
import { parseProfile } from '../../utils/parsers/iskam/profile';
import { parsePendingPayments } from '../../utils/parsers/iskam/pendingPayments';
import type { IskamProfile, PendingPayment } from '../../types/iskam';
import { logError } from '../../utils/reportError';

export async function fetchProfileAndPayments(): Promise<{ profile: IskamProfile | null; pendingPayments: PendingPayment[] }> {
    let html: string;
    try {
        html = await requestIskam('/InformaceOKlientovi');
    } catch (e) {
        logError('Iskam.fetchProfileAndPayments:network', e);
        return { profile: null, pendingPayments: [] };
    }

    let profile: IskamProfile | null = null;
    try { profile = parseProfile(html); } catch (e) { logError('Iskam.parseProfile', e); }

    let pendingPayments: PendingPayment[] = [];
    try { pendingPayments = parsePendingPayments(html); } catch (e) { logError('Iskam.parsePendingPayments', e); }

    return { profile, pendingPayments };
}
