import { describe, it, expect } from 'vitest';
import { parseNote, serializeNote, type DocumentNoteData } from '../noteParser';

describe('parseNote', () => {
    it('returns empty model for blank/invalid input', () => {
        const empty: DocumentNoteData = { cards: [], notes: '' };
        expect(parseNote('')).toEqual(empty);
        expect(parseNote('   ')).toEqual(empty);
        expect(parseNote(null)).toEqual(empty);
        expect(parseNote(undefined)).toEqual(empty);
        expect(parseNote(123 as unknown as string)).toEqual(empty);
    });

    it('round-trips the new {cards,notes} format', () => {
        const data: DocumentNoteData = {
            cards: [
                { id: 'c1', question: 'Q1?', answer: 'A1', collapsed: false, images: [] },
                { id: 'c2', question: 'Q2?', answer: '', collapsed: true, images: [] },
            ],
            notes: 'loose jotting',
        };
        expect(parseNote(serializeNote(data))).toEqual(data);
    });

    it('migrates legacy block JSON: toggle -> card, text/heading -> notes (order kept)', () => {
        const legacy = JSON.stringify([
            { id: 'b1', type: 'text', content: 'Para one' },
            { id: 'b2', type: 'toggle', question: 'Q?', answer: 'A', isCollapsed: false },
            { id: 'b3', type: 'heading', level: 2, content: 'Section' },
            { id: 'b4', type: 'text', content: 'Para two' },
        ]);
        const result = parseNote(legacy);
        expect(result.cards).toHaveLength(1);
        expect(result.cards[0].question).toBe('Q?');
        expect(result.cards[0].answer).toBe('A');
        expect(result.cards[0].collapsed).toBe(false);
        expect(result.notes).toBe('Para one\nSection\nPara two');
    });

    it('migrates legacy plain-text markdown: > -> card, rest -> notes (# stripped)', () => {
        const legacy = '# Title\nintro line\n> What is recall?\nActive retrieval.';
        const result = parseNote(legacy);
        expect(result.cards).toHaveLength(1);
        expect(result.cards[0].question).toBe('What is recall?');
        expect(result.cards[0].answer).toBe('Active retrieval.');
        expect(result.notes).toBe('Title\nintro line');
    });

    it('serializeNote returns "" when there is no meaningful content', () => {
        expect(serializeNote({ cards: [], notes: '' })).toBe('');
        expect(serializeNote({ cards: [{ id: 'c1', question: '', answer: '', collapsed: false, images: [] }], notes: '   ' })).toBe('');
    });

    it('serializeNote persists when a card has content', () => {
        const out = serializeNote({ cards: [{ id: 'c1', question: 'Q', answer: '', collapsed: false, images: [] }], notes: '' });
        expect(out).not.toBe('');
        expect(JSON.parse(out).cards[0].question).toBe('Q');
    });
});

describe('noteParser images', () => {
    it('round-trips card image hashes', () => {
        const json = JSON.stringify({
            cards: [{ id: 'c1', question: 'Q', answer: 'A', collapsed: true, images: ['abc', 'def'] }],
            notes: '',
        });
        expect(parseNote(json).cards[0].images).toEqual(['abc', 'def']);
    });
    it('defaults images to [] for legacy cards without the field', () => {
        const json = JSON.stringify({ cards: [{ id: 'c1', question: 'Q', answer: 'A', collapsed: true }], notes: '' });
        expect(parseNote(json).cards[0].images).toEqual([]);
    });
    it('drops non-string entries from images', () => {
        const json = JSON.stringify({
            cards: [{ id: 'c1', question: 'Q', answer: 'A', collapsed: true, images: ['ok', 5, null, 'ok2'] }],
            notes: '',
        });
        expect(parseNote(json).cards[0].images).toEqual(['ok', 'ok2']);
    });
    it('serializes images and never emits a data: payload', () => {
        const out = serializeNote({
            cards: [{ id: 'c1', question: 'Q', answer: 'A', collapsed: true, images: ['hash1'] }],
            notes: '',
        });
        expect(out).toContain('hash1');
        expect(out).not.toContain('data:');
    });
    it('throws if a card image somehow contains a data: URI (regression guard)', () => {
        expect(() =>
            serializeNote({
                cards: [{ id: 'c1', question: 'Q', answer: '', collapsed: true, images: ['data:image/jpeg;base64,AAAA'] }],
                notes: '',
            }),
        ).toThrow(/data:/);
    });
});
