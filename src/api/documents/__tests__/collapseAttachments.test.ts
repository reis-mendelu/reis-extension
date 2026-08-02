import { describe, it, expect } from 'vitest';
import { collapseAttachments, stableDocumentKey } from '../collapseAttachments';
import type { FileAttachment } from '../../../types/documents';

const VIEWER = (dok: string): FileAttachment => ({
  name: 'Přednáška 09',
  type: 'unknown',
  link: `https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=153920;on=0;dok=${dok};serializace=abc;lang=cz`,
});

const DOWNLOAD = (id: string): FileAttachment => ({
  name: 'Přednáška 09',
  type: 'pdf',
  link: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${id};id=153920;z=1;lang=cz`,
});

describe('collapseAttachments', () => {
  it('collapses the viewer + download pair IS emits for one document', () => {
    expect(collapseAttachments([VIEWER('359057'), DOWNLOAD('359057')])).toHaveLength(1);
  });

  it('keeps the DIRECT DOWNLOAD, not the viewer — reIS downloads, it does not open old IS', () => {
    const [only] = collapseAttachments([VIEWER('359057'), DOWNLOAD('359057')]);
    expect(only.link).toContain('download=359057');
    expect(only.link).not.toContain('dokumenty_cteni');
  });

  it('prefers the download even when the viewer comes second', () => {
    const [only] = collapseAttachments([DOWNLOAD('359057'), VIEWER('359057')]);
    expect(only.link).toContain('download=359057');
  });

  it('keeps the real mime type rather than the viewer\'s "unknown"', () => {
    expect(collapseAttachments([VIEWER('359057'), DOWNLOAD('359057')])[0].type).toBe('pdf');
  });

  it('does NOT merge two genuinely different documents', () => {
    expect(collapseAttachments([DOWNLOAD('359057'), DOWNLOAD('359056')])).toHaveLength(2);
  });

  it('does NOT dedupe by filename — IS serves distinct documents with identical names', () => {
    // Same display name, different document ids. Both must survive.
    const a = { ...DOWNLOAD('111'), name: 'Cvičení 23' };
    const b = { ...DOWNLOAD('222'), name: 'Cvičení 23' };
    expect(collapseAttachments([a, b])).toHaveLength(2);
  });

  it('passes through attachments that carry no document id', () => {
    const odd: FileAttachment = { name: 'x', type: 'unknown', link: 'https://is.mendelu.cz/auth/x.pl' };
    expect(collapseAttachments([odd])).toEqual([odd]);
  });

  it('is a no-op for a single attachment', () => {
    expect(collapseAttachments([DOWNLOAD('1')])).toHaveLength(1);
  });

  it('handles the empty case', () => {
    expect(collapseAttachments([])).toEqual([]);
  });
});

describe('stableDocumentKey', () => {
  it('is identical for the same document fetched twice, despite a changed serializace token', () => {
    // Measured: the token embeds a timestamp and differs on every fetch.
    const a = [
      {
        name: 'x',
        type: 'unknown',
        link: 'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=359057;serializace=203444766:1785673475:120344:user:aaa;lang=cz',
      },
    ];
    const b = [
      {
        name: 'x',
        type: 'unknown',
        link: 'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=359057;serializace=203444776:1785673478:120344:user:bbb;lang=cz',
      },
    ];
    expect(stableDocumentKey(a, 'Přednáška 10')).toBe(stableDocumentKey(b, 'Přednáška 10'));
  });

  it('differs for genuinely different documents', () => {
    expect(stableDocumentKey([DOWNLOAD('1')], 'x')).not.toBe(stableDocumentKey([DOWNLOAD('2')], 'x'));
  });

  it('matches a viewer link against its own direct download', () => {
    expect(stableDocumentKey([VIEWER('359057')], 'x')).toBe(
      stableDocumentKey([DOWNLOAD('359057')], 'x'),
    );
  });

  it('falls back to link+name when no document id is present', () => {
    const odd = [{ name: 'x', type: 'unknown', link: 'https://is.mendelu.cz/auth/other.pl' }];
    expect(stableDocumentKey(odd, 'N')).toBe('https://is.mendelu.cz/auth/other.pl_N');
  });
});
