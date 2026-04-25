import { parseUbytovani } from '../../utils/parsers/iskam/ubytovani';
import type { UbytovaniRow } from '../../types/iskam';
import { fetchIskam } from './client';

export async function fetchUbytovani(lang: 'cz' | 'en' = 'cz'): Promise<UbytovaniRow[]> {
    const html = await fetchIskam('/PrehledUbytovani', lang);
    return parseUbytovani(html);
}
