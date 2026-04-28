import { parseSkmDocuments } from '../../utils/parsers/iskam/skmDocuments';
import type { SkmDocument } from '../../types/iskam';

export async function fetchSkmDocuments(): Promise<SkmDocument[]> {
    console.log('[ISKAM] fetch skm.mendelu.cz/27393-dokumenty start');
    const response = await fetch('https://skm.mendelu.cz/27393-dokumenty');
    console.log('[ISKAM] fetch skm.mendelu.cz/27393-dokumenty status:', response.status, response.ok);
    if (!response.ok) throw new Error(`SKM documents fetch failed: ${response.status}`);
    const html = await response.text();
    const docs = parseSkmDocuments(html);
    console.log('[ISKAM] parseSkmDocuments result:', docs.length, docs.slice(0, 2));
    return docs;
}
