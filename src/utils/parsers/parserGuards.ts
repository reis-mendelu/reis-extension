// Guards for IS Mendelu HTML parsers. Goal: surface silent corruption when the
// upstream HTML drifts (column added, header renamed, etc.) instead of letting
// NaN/undefined flow through. All guards either throw ParserError (caught at
// row/page boundaries and logged) or call reportError for soft signals.

import { reportError } from '../reportError';

export class ParserError extends Error {
    readonly field: string;
    readonly context: string;
    readonly snippet?: string;
    constructor(field: string, context: string, message: string, snippet?: string) {
        super(`[${context}] ${field}: ${message}`);
        this.name = 'ParserError';
        this.field = field;
        this.context = context;
        this.snippet = snippet;
    }
}

export function parseRequiredInt(text: string, field: string, context: string): number {
    const n = parseInt(text, 10);
    if (Number.isNaN(n)) {
        throw new ParserError(field, context, `parseInt failed on ${JSON.stringify(text)}`);
    }
    return n;
}

// Soft-log when a numeric-looking text fails to parse. Returns null otherwise.
// Heuristic: only log when text begins with a digit or sign — pure-text in a
// numeric field signals a wrong column index (separate class of bug), not the
// drift we want to surface here.
export function parseOptionalInt(text: string, field: string, context: string): number | null {
    if (!text) return null;
    const n = parseInt(text, 10);
    if (Number.isNaN(n)) {
        if (/^[-+]?\d/.test(text)) {
            reportError(`Parser.${context}`, new Error(`parseInt failed on ${JSON.stringify(text)}`), { field });
        }
        return null;
    }
    return n;
}

export function requireCell(cells: ArrayLike<Element>, idx: number, field: string, context: string, rowSnippet?: string): Element {
    if (idx < 0 || idx >= cells.length) {
        throw new ParserError(field, context, `cell index ${idx} out of bounds (length ${cells.length})`, rowSnippet);
    }
    const cell = cells[idx];
    if (!cell) {
        throw new ParserError(field, context, `cell at index ${idx} is null`, rowSnippet);
    }
    return cell;
}
