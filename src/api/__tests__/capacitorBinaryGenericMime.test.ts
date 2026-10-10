import { describe, it, expect } from 'vitest';
import { filenameFromResponse } from '../capacitorBinary';

/**
 * A server that does not know what it is sending says application/octet-stream
 * (or binary/octet-stream, or nothing). That names no type, so it must not
 * stand in for one: without a filename or a row type the name got no
 * extension at all, where a missing Content-Type falls back to .pdf.
 */
describe('filenameFromResponse with a generic content type', () => {
  it('falls back to .pdf, as a missing Content-Type does', () => {
    expect(filenameFromResponse({ 'Content-Type': 'application/octet-stream' })).toBe(
      'dokument.pdf'
    );
    expect(filenameFromResponse({ 'content-type': 'binary/octet-stream' })).toBe('dokument.pdf');
    expect(filenameFromResponse({ 'Content-Type': '' })).toBe('dokument.pdf');
    expect(
      filenameFromResponse({ 'Content-Type': 'Application/Octet-Stream; charset=binary' })
    ).toBe('dokument.pdf');
  });

  it("falls back to .pdf when the row's type is IS's 'unknown'", () => {
    expect(
      filenameFromResponse(
        { 'Content-Type': 'application/octet-stream' },
        { name: 'Přednáška 3', type: 'unknown' }
      )
    ).toBe('Přednáška 3.pdf');
  });

  it("never forces .pdf over the row's own type", () => {
    expect(
      filenameFromResponse(
        { 'Content-Type': 'application/octet-stream' },
        { name: 'Cvičení', type: 'pptx' }
      )
    ).toBe('Cvičení.pptx');
  });
});
