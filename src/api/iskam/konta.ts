import { parseKonta } from '../../utils/parsers/iskam/konta';
import type { KontoRow } from '../../types/iskam';
import { fetchIskam } from './client';

export async function fetchKonta(lang: 'cz' | 'en' = 'cz'): Promise<KontoRow[]> {
    const html = await fetchIskam('/Konta', lang);
    return parseKonta(html, lang);
}
