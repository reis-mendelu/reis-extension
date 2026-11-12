import { describe, it, expect, vi } from 'vitest';
import { pushGist } from '../gist-push';
import { GIST_ID } from '../gate';

type Call = { url: string; init?: RequestInit };

function fakeFetch(liveAfterPatch: string, patchStatus = 200) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (init?.method === 'PATCH') return new Response('{}', { status: patchStatus });
    return new Response(JSON.stringify({ files: { 'privacy.md': { content: liveAfterPatch } } }), {
      status: 200,
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('pushGist', () => {
  it('writes the policy into privacy.md of the policy gist, with the token', async () => {
    const { impl, calls } = fakeFetch('policy text\n');
    await pushGist({ token: 't0k', policy: 'policy text\n', fetchImpl: impl });

    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe(`https://api.github.com/gists/${GIST_ID}`);
    expect((patch.init!.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
    expect(JSON.parse(String(patch.init!.body))).toEqual({
      files: { 'privacy.md': { content: 'policy text\n' } },
    });
  });

  it('reads the gist back and fails when it does not match', async () => {
    const { impl } = fakeFetch('something else');
    await expect(pushGist({ token: 't', policy: 'policy', fetchImpl: impl })).rejects.toThrow(
      /read-back differs/
    );
  });

  it('fails on a rejected write, with the status', async () => {
    const { impl } = fakeFetch('policy', 404);
    await expect(pushGist({ token: 't', policy: 'policy', fetchImpl: impl })).rejects.toThrow(
      /HTTP 404/
    );
  });

  it('refuses to run without a token', async () => {
    const { impl, calls } = fakeFetch('policy');
    await expect(pushGist({ token: '', policy: 'policy', fetchImpl: impl })).rejects.toThrow(
      /GIST_TOKEN/
    );
    expect(calls).toEqual([]);
  });
});
