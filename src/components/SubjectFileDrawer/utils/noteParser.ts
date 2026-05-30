export interface NoteBlock {
    id: string;
    type: 'text' | 'toggle' | 'heading';
    content?: string;   // for text and heading blocks
    level?: 1 | 2 | 3;  // for heading blocks
    question?: string;  // for toggle blocks
    answer?: string;    // for toggle blocks
    isCollapsed?: boolean;
}

/**
 * Parses note text into text paragraphs, heading paragraphs, and collapsible Q&A blocks.
 * Supports both JSON blocks format and legacy plain-text Markdown format.
 */
export function parseNoteToBlocks(noteText: string | null | undefined): NoteBlock[] {
    if (!noteText || typeof noteText !== 'string' || !noteText.trim()) {
        return [{ id: `block-init-${Date.now()}`, type: 'text', content: '' }];
    }
    
    // 1. Try parsing as JSON array (modern structured block format)
    try {
        if (noteText.trim().startsWith('[')) {
            const parsed = JSON.parse(noteText);
            if (Array.isArray(parsed)) {
                return parsed.map((block: any, idx) => ({
                    id: block.id || `block-${idx}-${Date.now()}`,
                    type: block.type === 'toggle' ? 'toggle' : block.type === 'heading' ? 'heading' : 'text',
                    content: block.content || '',
                    level: block.level || 1,
                    question: block.question || '',
                    answer: block.answer || '',
                    isCollapsed: block.isCollapsed !== false // default to collapsed
                }));
            }
        }
    } catch (e) {
        // Fall back to plain text parsing on JSON errors
    }
    
    // 2. Fallback: Parse plain text Markdown format (lines starting with '>' or headings '#')
    const lines = noteText.split('\n');
    const blocks: NoteBlock[] = [];
    let currentTextLines: string[] = [];
    let blockIdCounter = 0;
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('>')) {
            if (currentTextLines.length > 0) {
                blocks.push({
                    id: `parsed-text-${blockIdCounter++}-${Date.now()}`,
                    type: 'text',
                    content: currentTextLines.join('\n')
                });
                currentTextLines = [];
            }
            
            const question = trimmed.replace(/^>\s*/, '');
            const answerLines: string[] = [];
            i++;
            
            while (i < lines.length && !lines[i].trim().startsWith('>') && lines[i].trim() !== '') {
                answerLines.push(lines[i]);
                i++;
            }
            
            blocks.push({
                id: `parsed-toggle-${blockIdCounter++}-${Date.now()}`,
                type: 'toggle',
                question,
                answer: answerLines.join('\n').trim(),
                isCollapsed: true
            });
        } else {
            // Check for Markdown headings: #, ##, ###
            const headingMatch = line.match(/^\s*(#{1,3})\s(.*)$/);
            if (headingMatch) {
                if (currentTextLines.length > 0) {
                    blocks.push({
                        id: `parsed-text-${blockIdCounter++}-${Date.now()}`,
                        type: 'text',
                        content: currentTextLines.join('\n')
                    });
                    currentTextLines = [];
                }
                const level = headingMatch[1].length as 1 | 2 | 3;
                const content = headingMatch[2];
                blocks.push({
                    id: `parsed-heading-${blockIdCounter++}-${Date.now()}`,
                    type: 'heading',
                    level,
                    content
                });
                i++;
            } else {
                currentTextLines.push(line);
                i++;
            }
        }
    }
    
    if (currentTextLines.length > 0) {
        blocks.push({
            id: `parsed-text-${blockIdCounter++}-${Date.now()}`,
            type: 'text',
            content: currentTextLines.join('\n')
        });
    }
    
    return blocks.length > 0 ? blocks : [{ id: `block-init-${Date.now()}`, type: 'text', content: '' }];
}

/**
 * Serializes block arrays back into JSON notes format for IndexedDB storage.
 */
export function serializeBlocksToNote(blocks: NoteBlock[]): string {
    return JSON.stringify(blocks);
}
