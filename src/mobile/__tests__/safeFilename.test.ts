import { describe, it, expect } from 'vitest';
import { safeFilename } from '../safeFilename';

describe('safeFilename', () => {
  it('leaves an ordinary IS filename alone, diacritics included', () => {
    expect(safeFilename('Přednáška 09 — úvod.pdf')).toBe('Přednáška 09 — úvod.pdf');
  });

  it('strips a directory prefix rather than writing into it', () => {
    expect(safeFilename('sub/dir/x.pdf')).toBe('x.pdf');
    expect(safeFilename('sub\\dir\\x.pdf')).toBe('x.pdf');
  });

  it('cannot escape upwards — the traversal case', () => {
    expect(safeFilename('../../databases/reis.db')).toBe('reis.db');
    expect(safeFilename('..\\..\\x.pdf')).toBe('x.pdf');
  });

  it('refuses a name that is only dots, which is a directory reference', () => {
    expect(safeFilename('..')).toBe('dokument');
    expect(safeFilename('.')).toBe('dokument');
  });

  it('falls back for an empty or whitespace name', () => {
    expect(safeFilename('')).toBe('dokument');
    expect(safeFilename('   ')).toBe('dokument');
    expect(safeFilename('a/')).toBe('dokument');
  });

  it('drops NUL and control characters, which truncate a path in native code', () => {
    expect(safeFilename('x\u0000.pdf')).toBe('x.pdf');
    expect(safeFilename('re\nport.pdf')).toBe('report.pdf');
  });

  it('keeps a leading dot from hiding the file', () => {
    expect(safeFilename('.hidden.pdf')).toBe('hidden.pdf');
  });

  it('bounds the length — some filesystems reject a 300-char name', () => {
    expect(safeFilename('a'.repeat(400)).length).toBeLessThanOrEqual(200);
  });
});
