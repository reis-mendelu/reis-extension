import { requestIskam } from './client';
import { parseReservations } from '../../utils/parsers/iskam/reservations';
import type { IskamReservation } from '../../types/iskam';
import { logError } from '../../utils/reportError';

export async function fetchReservations(): Promise<IskamReservation[]> {
    try {
        const html = await requestIskam('/Rezervace');
        return parseReservations(html);
    } catch (e) {
        logError('Iskam.fetchReservations', e);
        return [];
    }
}
