// Reading a download's body with a ceiling, shared by mendelu_read_file (files.ts) and the
// bulk download of mendelu_build_my_map (buildMap.ts). Nothing here touches the disk.

/** A body over its ceiling: thrown before anything past the ceiling is buffered. */
export class TooBigError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`This file is over ${Math.round(limit / 1024 / 1024)} MB, too big to read here.`);
    this.name = 'TooBigError';
    this.limit = limit;
  }
}

/** The body, refusing anything over `limit` bytes without buffering past it. */
export async function readCapped(res: Response, limit: number): Promise<Uint8Array> {
  if (Number(res.headers.get('content-length') ?? 0) > limit) {
    await res.body?.cancel().catch(() => {});
    throw new TooBigError(limit);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    const whole = new Uint8Array(await res.arrayBuffer());
    if (whole.byteLength > limit) throw new TooBigError(limit);
    return whole;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new TooBigError(limit);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
