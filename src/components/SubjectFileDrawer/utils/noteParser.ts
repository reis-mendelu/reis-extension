export interface NoteCardData {
    id: string;
    question: string;
    answer: string;
    collapsed: boolean;
}

export interface DocumentNoteData {
    cards: NoteCardData[];
    notes: string;
}

// Monotonic counter so card IDs stay unique within a single parse call.
let idCounter = 0;
function newId(): string {
    return `card-${Date.now()}-${(idCounter++).toString(36)}`;
}

function coerce(obj: Record<string, unknown>): DocumentNoteData {
    const rawCards = Array.isArray(obj.cards) ? obj.cards : [];
    const cards: NoteCardData[] = rawCards.map((c) => {
        const card = (c ?? {}) as Record<string, unknown>;
        return {
            id: typeof card.id === 'string' ? card.id : newId(),
            question: typeof card.question === 'string' ? card.question : '',
            answer: typeof card.answer === 'string' ? card.answer : '',
            collapsed: card.collapsed !== false,
        };
    });
    return { cards, notes: typeof obj.notes === 'string' ? obj.notes : '' };
}

// Legacy block JSON: [{ type: 'text'|'heading'|'toggle', ... }]
function migrateBlocks(blocks: unknown[]): DocumentNoteData {
    const cards: NoteCardData[] = [];
    const notesParts: string[] = [];
    for (const raw of blocks) {
        const b = (raw ?? {}) as Record<string, unknown>;
        if (b.type === 'toggle') {
            cards.push({
                id: newId(),
                question: typeof b.question === 'string' ? b.question : '',
                answer: typeof b.answer === 'string' ? b.answer : '',
                collapsed: b.isCollapsed !== false,
            });
        } else {
            // 'text' and 'heading' both flatten into the Notes box
            const content = typeof b.content === 'string' ? b.content : '';
            if (content) notesParts.push(content);
        }
    }
    return { cards, notes: notesParts.join('\n').trim() };
}

// Legacy plain-text markdown: '>' lines are cards, everything else is notes.
function migratePlainText(text: string): DocumentNoteData {
    const lines = text.split('\n');
    const cards: NoteCardData[] = [];
    const notesParts: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('>')) {
            const question = trimmed.replace(/^>\s*/, '');
            const answerLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('>') && lines[i].trim() !== '') {
                answerLines.push(lines[i]);
                i++;
            }
            cards.push({ id: newId(), question, answer: answerLines.join('\n').trim(), collapsed: true });
        } else {
            const headingMatch = lines[i].match(/^\s*#{1,3}\s(.*)$/);
            notesParts.push(headingMatch ? headingMatch[1] : lines[i]);
            i++;
        }
    }
    return { cards, notes: notesParts.join('\n').trim() };
}

export function parseNote(raw: string | null | undefined): DocumentNoteData {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return { cards: [], notes: '' };
    const trimmed = raw.trim();

    if (trimmed.startsWith('{')) {
        try {
            const obj = JSON.parse(trimmed);
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) return coerce(obj);
        } catch { /* fall through */ }
    }
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) return migrateBlocks(arr);
        } catch { /* fall through */ }
    }
    return migratePlainText(trimmed);
}

export function serializeNote(data: DocumentNoteData): string {
    const hasCard = data.cards.some((c) => c.question.trim() || c.answer.trim());
    if (!hasCard && !data.notes.trim()) return '';
    return JSON.stringify({ cards: data.cards, notes: data.notes });
}
