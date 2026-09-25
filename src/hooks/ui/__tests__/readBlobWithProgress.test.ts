import { describe, it, expect, vi } from 'vitest';
import { readBlobWithProgress } from '../readBlobWithProgress';

/** A Response-shaped stub whose body streams the given chunks. */
function streaming(chunks: Uint8Array[], headers: Record<string, string>) {
  let i = 0;
  return {
    headers: new Headers(headers),
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined },
      }),
    },
    blob: async () => new Blob(chunks as BlobPart[]),
  } as unknown as Response;
}

const CHUNKS = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6])];

describe('readBlobWithProgress', () => {
  it('reports bytes as they arrive against the declared total', async () => {
    const ticks: { loaded: number; total: number | null }[] = [];
    const blob = await readBlobWithProgress(
      streaming(CHUNKS, { 'content-length': '6', 'content-type': 'application/pdf' }),
      (t) => ticks.push(t)
    );

    expect(blob.size).toBe(6);
    expect(blob.type).toBe('application/pdf');
    expect(ticks).toEqual([
      { loaded: 0, total: 6 },
      { loaded: 4, total: 6 },
      { loaded: 6, total: 6 },
    ]);
  });

  it('keeps total null when IS sends no Content-Length, so the UI stays indeterminate', async () => {
    // IS generates sealed PDFs on the fly and answers chunked — claiming a
    // percentage there would mean inventing the denominator.
    const ticks: { loaded: number; total: number | null }[] = [];
    await readBlobWithProgress(streaming(CHUNKS, {}), (t) => ticks.push(t));

    expect(ticks.every((t) => t.total === null)).toBe(true);
    expect(ticks.at(-1)).toEqual({ loaded: 6, total: null });
  });

  it('ignores a zero or unparseable Content-Length rather than dividing by it', async () => {
    const ticks: { loaded: number; total: number | null }[] = [];
    await readBlobWithProgress(streaming(CHUNKS, { 'content-length': '0' }), (t) => ticks.push(t));
    expect(ticks.every((t) => t.total === null)).toBe(true);
  });

  it('still returns the bytes when the body cannot be streamed', async () => {
    // Capacitor's WebView shims and jsdom both hand back a body with no
    // getReader. A download that works must not start failing for a progress
    // bar, so this degrades to one indeterminate tick and the whole blob.
    const onTick = vi.fn();
    const res = {
      headers: new Headers({ 'content-length': '6' }),
      body: undefined,
      blob: async () => new Blob(CHUNKS as BlobPart[]),
    } as unknown as Response;

    const blob = await readBlobWithProgress(res, onTick);

    expect(blob.size).toBe(6);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith({ loaded: 0, total: 6 });
  });
});
