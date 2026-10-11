import { describe, expect, it } from 'vitest';
import { releaseToTrack, type PlayHttp, type PlayResponse } from '../playRelease';

type Call = { method: string; path: string; body?: unknown };

function fakePlay(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const play: PlayHttp = async (method, path, body) => {
    calls.push({ method, path, body });
    const key = Object.keys(routes)
      .filter((k) => `${method} ${path}`.startsWith(k))
      .sort((x, y) => y.length - x.length)[0];
    if (!key) throw new Error(`unexpected ${method} ${path}`);
    return routes[key] as PlayResponse;
  };
  return { play, calls };
}

const args = {
  track: 'alpha',
  versionName: '5.4.1',
  notes: 'Rozvrh je znovu jen po dnech.',
  bundle: Buffer.from('aab'),
};
const tracks = (list: Array<{ track: string; codes?: string[] }>) => ({
  tracks: list.map((t) => ({
    track: t.track,
    releases: t.codes ? [{ versionCodes: t.codes, status: 'completed' }] : [],
  })),
});

describe('releaseToTrack', () => {
  it('uploads the bundle, sets the release with notes on the track, and commits', async () => {
    const { play, calls } = fakePlay({
      'POST /edits': { id: 'E1' },
      'GET /edits/E1/tracks': tracks([{ track: 'alpha', codes: ['50300'] }]),
      'POST /edits/E1/bundles': { versionCode: 50401 },
      'PUT /edits/E1/tracks/alpha': {},
      'POST /edits/E1:commit': { id: 'E1' },
    });
    const out = await releaseToTrack({ ...args, play, dryRun: false });
    expect(out.status).toBe('released');
    const put = calls.find((c) => c.method === 'PUT');
    expect(JSON.stringify(put?.body)).toContain('50401');
    expect(JSON.stringify(put?.body)).toContain('cs-CZ');
    expect(calls.at(-1)?.path).toContain(':commit');
  });

  it('reports success without touching anything when that versionCode is already on the track', async () => {
    const { play, calls } = fakePlay({
      'POST /edits': { id: 'E1' },
      'GET /edits/E1/tracks': tracks([{ track: 'alpha', codes: ['50401'] }]),
      'DELETE /edits/E1': {},
    });
    const out = await releaseToTrack({ ...args, expectedVersionCode: 50401, play, dryRun: false });
    expect(out.status).toBe('already-released');
    expect(calls.some((c) => c.method === 'PUT' || c.path.includes(':commit'))).toBe(false);
  });

  it('fails clearly and lists the real track names when the track does not exist', async () => {
    const { play } = fakePlay({
      'POST /edits': { id: 'E1' },
      'GET /edits/E1/tracks': tracks([{ track: 'internal' }, { track: 'production' }]),
      'DELETE /edits/E1': {},
    });
    await expect(releaseToTrack({ ...args, play, dryRun: false })).rejects.toThrow(
      /alpha.*internal, production/
    );
  });

  it('a dry run opens an edit, checks the track, and deletes the edit: no upload, no commit', async () => {
    const { play, calls } = fakePlay({
      'POST /edits': { id: 'E1' },
      'GET /edits/E1/tracks': tracks([{ track: 'alpha', codes: ['50300'] }]),
      'DELETE /edits/E1': {},
    });
    const out = await releaseToTrack({ ...args, play, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(calls.some((c) => c.path.includes('bundles') || c.path.includes(':commit'))).toBe(false);
    expect(calls.at(-1)?.method).toBe('DELETE');
  });

  it('deletes the edit when the upload fails, so no half-open edit is left behind', async () => {
    const { play, calls } = fakePlay({
      'POST /edits': { id: 'E1' },
      'GET /edits/E1/tracks': tracks([{ track: 'alpha', codes: ['50300'] }]),
      'POST /edits/E1/bundles': new Error('boom'),
      'DELETE /edits/E1': {},
    });
    const failing: PlayHttp = async (m, p, b) => {
      const r = await play(m, p, b);
      if (r instanceof Error) throw r;
      return r;
    };
    await expect(releaseToTrack({ ...args, play: failing, dryRun: false })).rejects.toThrow('boom');
    expect(calls.at(-1)?.method).toBe('DELETE');
  });
});
