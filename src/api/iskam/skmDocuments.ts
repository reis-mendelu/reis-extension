import { parseSkmDocuments } from '../../utils/parsers/iskam/skmDocuments';
import type { SkmDocument } from '../../types/iskam';

export async function fetchSkmDocuments(): Promise<SkmDocument[]> {
    const response = await fetch('https://skm.mendelu.cz/27393-dokumenty');
    if (!response.ok) throw new Error(`SKM documents fetch failed: ${response.status}`);
    return parseSkmDocuments(await response.text());
}
