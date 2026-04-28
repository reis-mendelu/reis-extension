import { parseKontaTransactions } from '../../utils/parsers/iskam/kontaTransactions';
import type { KontaTransaction } from '../../types/iskam';
import { fetchIskam } from './client';

export async function fetchKontaTransactions(href: string): Promise<KontaTransaction[]> {
    const html = await fetchIskam(href, 'cz');
    return parseKontaTransactions(html);
}
