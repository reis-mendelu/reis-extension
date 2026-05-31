import { describe, it, expect } from 'vitest';
import { collectReferencedImages } from '../collectReferencedImages';

describe('collectReferencedImages', () => {
    it('unions image hashes across all note entries', () => {
        const entries = [
            { note: JSON.stringify({ cards: [{ id: 'a', question: '', answer: '', collapsed: true, images: ['h1', 'h2'] }], notes: '' }) },
            { note: JSON.stringify({ cards: [{ id: 'b', question: '', answer: '', collapsed: true, images: ['h2', 'h3'] }], notes: '' }) },
        ];
        const refs = collectReferencedImages(entries);
        expect([...refs].sort()).toEqual(['h1', 'h2', 'h3']);
    });
    it('returns an empty set for notes without images', () => {
        const entries = [{ note: JSON.stringify({ cards: [], notes: 'plain' }) }];
        expect(collectReferencedImages(entries).size).toBe(0);
    });
    it('ignores empty/invalid notes', () => {
        expect(collectReferencedImages([{ note: '' }, { note: 'not json' }]).size).toBe(0);
    });
});
