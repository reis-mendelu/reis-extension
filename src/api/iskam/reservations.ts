import { requestIskam } from './client';
import { parseReservations } from '../../utils/parsers/iskam/reservations';
import type { IskamReservation } from '../../types/iskam';

export async function fetchReservations(): Promise<IskamReservation[]> {
    try {
        const html = await requestIskam('/Rezervace');
        return parseReservations(html);
    } catch (e) {
        console.warn('[reIS:iskam] fetchReservations failed', e);
        return [];
    }
}
