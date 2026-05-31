import { parseNote } from '../../components/SubjectFileDrawer/utils/noteParser';

/** Union of every card image hash across the given stored note values. */
export function collectReferencedImages(entries: Array<{ note: string }>): Set<string> {
    const refs = new Set<string>();
    for (const { note } of entries) {
        for (const card of parseNote(note).cards) {
            for (const h of card.images) refs.add(h);
        }
    }
    return refs;
}
