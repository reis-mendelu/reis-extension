import { describe, it, expect } from 'vitest';
import { sameContent, gateFindings, readLiveGist, GIST_ID, GIST_RAW_URL } from '../gate';
import { BEGIN, END } from '../checklist';

describe('sameContent', () => {
  it('ignores one trailing newline and CRLF', () => {
    expect(sameContent('a\nb\n', 'a\nb')).toBe(true);
    expect(sameContent('a\r\nb', 'a\nb\n')).toBe(true);
  });
  it('sees any real difference', () => {
    expect(sameContent('a\nb', 'a\nc')).toBe(false);
  });
});

describe('gateFindings', () => {
  const body = (items: string) => `summary\n${BEGIN}\n${items}\n${END}`;
  const expected = ['Play Data safety: + PSL_PHOTOS', 'Chrome Web Store: + Website content'];

  it('passes when the gist matches and every expected item is ticked', () => {
    const prBody = body(
      '- [x] Play Data safety: + PSL_PHOTOS\n- [X] Chrome Web Store: + Website content'
    );
    expect(gateFindings({ liveGist: 'p', repoPolicy: 'p\n', prBody, expected })).toEqual([]);
  });

  it('fails on a stale gist, naming the fix', () => {
    const out = gateFindings({
      liveGist: 'old',
      repoPolicy: 'new',
      prBody: body(''),
      expected: [],
    });
    expect(out.join('\n')).toMatch(/gist.*privacy:publish/);
  });

  it('fails on an expected item that is unticked', () => {
    const prBody = body(
      '- [x] Play Data safety: + PSL_PHOTOS\n- [ ] Chrome Web Store: + Website content'
    );
    expect(gateFindings({ liveGist: 'p', repoPolicy: 'p', prBody, expected })).toEqual([
      'Not ticked in the release PR: Chrome Web Store: + Website content',
    ]);
  });

  it('fails on an expected item someone deleted from the body', () => {
    const prBody = body('- [x] Play Data safety: + PSL_PHOTOS');
    expect(gateFindings({ liveGist: 'p', repoPolicy: 'p', prBody, expected })).toEqual([
      'Not ticked in the release PR: Chrome Web Store: + Website content',
    ]);
  });

  it('fails on a block the refresh has not rewritten yet', () => {
    // The old block had everything ticked; the regenerated one wants a new item.
    const prBody = body('- [x] Play Data safety: + PSL_PHOTOS');
    const out = gateFindings({
      liveGist: 'p',
      repoPolicy: 'p',
      prBody,
      expected: [...expected, 'App Store privacy label: + Photos or Videos'],
    });
    expect(out).toHaveLength(2);
  });

  it('fails when the gist could not be read, rather than passing', () => {
    expect(
      gateFindings({ liveGist: null, repoPolicy: 'p', prBody: body(''), expected: [] }).join('\n')
    ).toMatch(/could not read/i);
  });
});

describe('readLiveGist', () => {
  // From a runner the REST API fails with or without GITHUB_TOKEN, so the gate
  // reads the raw URL, with no credentials, past the CDN's 5-minute cache.
  it('reads the raw gist, uncached and without credentials', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const got = await readLiveGist(
      async (url, init) => {
        seen = { url: String(url), init };
        return new Response('policy', { status: 200 });
      },
      () => 42
    );
    expect(got).toEqual({ content: 'policy' });
    expect(seen?.url).toBe(`${GIST_RAW_URL}?t=42`);
    expect(GIST_RAW_URL).toContain(GIST_ID);
    expect(new Headers(seen?.init?.headers).has('authorization')).toBe(false);
  });

  it('says why when the read fails', async () => {
    const got = await readLiveGist(async () => new Response('nope', { status: 403 }));
    expect(got).toEqual({ content: null, reason: 'HTTP 403' });
  });

  it('says why when the network fails', async () => {
    const got = await readLiveGist(async () => {
      throw new Error('ENOTFOUND');
    });
    expect(got).toEqual({ content: null, reason: 'ENOTFOUND' });
  });
});
