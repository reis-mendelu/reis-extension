import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asPlainSvg } from '../plainSvg';

const DIR = resolve(__dirname, '../../../public/emoji');

// emoji:fetch writes a CDN response into public/, which ships in every build.
describe('asPlainSvg', () => {
  it('accepts every emoji the app ships today', () => {
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.svg'))) {
      const text = readFileSync(resolve(DIR, f), 'utf8');
      expect(asPlainSvg(f, text)).toBe(text);
    }
  });

  it.each([
    ['a script', '<svg><script>alert(1)</script></svg>'],
    ['an event handler', '<svg onload="alert(1)"><path d="M0 0"/></svg>'],
    ['a transform hiding a url()', '<svg><g transform="url(#x)"><path d="M0 0"/></g></svg>'],
    ['a link', '<svg><a href="https://x.io"><path d="M0 0"/></a></svg>'],
    ['an external image', '<svg><image href="https://x.io/a.png"/></svg>'],
    ['a foreign object', '<svg><foreignObject><div/></foreignObject></svg>'],
    ['a CSS url()', '<svg><path style="fill:url(https://x.io)"/></svg>'],
    // Inside a well-formed root, so only the content check can refuse it.
    ['an entity declaration', '<svg><!ENTITY x "y"><path d="M0 0"/></svg>'],
    [
      'a namespace-prefixed script',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>',
    ],
    ['a style attribute', '<svg><path style="fill:red" d="M0 0"/></svg>'],
    ['a style element', '<svg><style>path{fill:red}</style></svg>'],
    ['a comment', '<svg><!-- hi --><path d="M0 0"/></svg>'],
    ['text outside any element', '<svg>hello<path d="M0 0"/></svg>'],
    ['a foreign namespace', '<svg xmlns="http://www.w3.org/1999/xhtml"><path d="M0 0"/></svg>'],
    ['an unquoted attribute', '<svg><path d=M0 /></svg>'],
  ])('refuses an SVG with %s', (_, svg) => expect(() => asPlainSvg('x', svg)).toThrow());

  it('refuses an HTML error page', () =>
    expect(() => asPlainSvg('x', '<html><body>Not found</body></html>')).toThrow(/not an SVG/));

  it('refuses something far larger than an emoji', () =>
    expect(() => asPlainSvg('x', `<svg>${'<path d="M0 0"/>'.repeat(5000)}</svg>`)).toThrow(
      /bytes/
    ));
});
