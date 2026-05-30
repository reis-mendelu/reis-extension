import { describe, it, expect } from 'vitest';
import { parseNoteToBlocks, serializeBlocksToNote, type NoteBlock } from './utils/noteParser';

describe('parseNoteToBlocks', () => {
    it('should return initial empty block for empty or invalid inputs', () => {
        const defaultBlock = (arr: any[]) => {
            expect(arr).toHaveLength(1);
            expect(arr[0].type).toBe('text');
            expect(arr[0].content).toBe('');
        };
        
        defaultBlock(parseNoteToBlocks(''));
        defaultBlock(parseNoteToBlocks('   '));
        defaultBlock(parseNoteToBlocks(null));
        defaultBlock(parseNoteToBlocks(undefined));
        defaultBlock(parseNoteToBlocks(123 as any));
    });

    it('should parse legacy markdown paragraph to blocks', () => {
        const text = 'This is a simple note without any special blocks.';
        const result = parseNoteToBlocks(text);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('text');
        expect(result[0].content).toBe('This is a simple note without any special blocks.');
    });

    it('should parse legacy markdown single Q&A block', () => {
        const text = '> What is active recall?\nIt is a learning technique.';
        const result = parseNoteToBlocks(text);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('toggle');
        expect(result[0].question).toBe('What is active recall?');
        expect(result[0].answer).toBe('It is a learning technique.');
    });

    it('should parse legacy markdown multiple Q&A blocks and paragraphs', () => {
        const text = `Paragraph 1.

> Question 1?
Answer 1

Paragraph 2.`;

        const result = parseNoteToBlocks(text);
        expect(result).toHaveLength(3);
        
        expect(result[0].type).toBe('text');
        expect(result[0].content).toBe('Paragraph 1.\n');
        
        expect(result[1].type).toBe('toggle');
        expect(result[1].question).toBe('Question 1?');
        expect(result[1].answer).toBe('Answer 1');
        
        expect(result[2].type).toBe('text');
        expect(result[2].content).toBe('\nParagraph 2.');
    });

    it('should parse structured JSON array blocks', () => {
        const blocks: NoteBlock[] = [
            { id: 'b1', type: 'text', content: 'Hello World' },
            { id: 'b2', type: 'toggle', question: 'Q1?', answer: 'A1', isCollapsed: false },
            { id: 'b3', type: 'heading', level: 2, content: 'Heading 2' }
        ];
        const jsonText = serializeBlocksToNote(blocks);
        
        const result = parseNoteToBlocks(jsonText);
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
            id: 'b1',
            type: 'text',
            content: 'Hello World',
            level: 1,
            question: '',
            answer: '',
            isCollapsed: true
        });
        expect(result[1]).toEqual({
            id: 'b2',
            type: 'toggle',
            content: '',
            level: 1,
            question: 'Q1?',
            answer: 'A1',
            isCollapsed: false
        });
        expect(result[2]).toEqual({
            id: 'b3',
            type: 'heading',
            content: 'Heading 2',
            level: 2,
            question: '',
            answer: '',
            isCollapsed: true
        });
    });

    it('should parse legacy markdown headings to blocks', () => {
        const text = `# Heading 1
Some paragraph text.
## Heading 2
### Heading 3`;
        const result = parseNoteToBlocks(text);
        expect(result).toHaveLength(4);

        expect(result[0].type).toBe('heading');
        expect(result[0].level).toBe(1);
        expect(result[0].content).toBe('Heading 1');

        expect(result[1].type).toBe('text');
        expect(result[1].content).toBe('Some paragraph text.');

        expect(result[2].type).toBe('heading');
        expect(result[2].level).toBe(2);
        expect(result[2].content).toBe('Heading 2');

        expect(result[3].type).toBe('heading');
        expect(result[3].level).toBe(3);
        expect(result[3].content).toBe('Heading 3');
    });
});
