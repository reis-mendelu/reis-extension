import { describe, it, expect } from 'vitest';
import { sameContent, gateFindings } from '../gate';
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

  it('passes when the gist matches and every item is ticked', () => {
    expect(gateFindings({ liveGist: 'p', repoPolicy: 'p\n', prBody: body('- [x] done') })).toEqual(
      []
    );
  });

  it('fails on a stale gist, naming the fix', () => {
    const out = gateFindings({ liveGist: 'old', repoPolicy: 'new', prBody: body('') });
    expect(out.join('\n')).toMatch(/gist.*privacy:publish/);
  });

  it('fails on each unticked item', () => {
    const out = gateFindings({
      liveGist: 'p',
      repoPolicy: 'p',
      prBody: body('- [ ] Chrome Web Store: + Website content\n- [x] Play'),
    });
    expect(out).toEqual(['Unticked privacy item: Chrome Web Store: + Website content']);
  });

  it('fails when the privacy block is missing entirely', () => {
    expect(gateFindings({ liveGist: 'p', repoPolicy: 'p', prBody: 'no block' }).join('\n')).toMatch(
      /privacy block/
    );
  });

  it('fails when the gist could not be read, rather than passing', () => {
    expect(gateFindings({ liveGist: null, repoPolicy: 'p', prBody: body('') }).join('\n')).toMatch(
      /could not read/i
    );
  });
});
