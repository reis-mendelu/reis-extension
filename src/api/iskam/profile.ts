import { requestIskam } from './client';
import { parseProfile } from '../../utils/parsers/iskam/profile';
import type { IskamProfile } from '../../types/iskam';

export async function fetchProfile(): Promise<IskamProfile | null> {
    try {
        const html = await requestIskam('/InformaceOKlientovi');
        return parseProfile(html);
    } catch (e) {
        console.warn('[reIS:iskam] fetchProfile failed', e);
        return null;
    }
}
