import { describe, it, expect } from 'vitest';
import type { Flow } from '../../../privacy/disclosures';
import { diffStores } from '../diff';
import { renderChecklist, uncheckedItems, placeBlock, BEGIN, END } from '../checklist';

const flow = (
  over: Partial<Flow['stores']> = {},
  rows: Flow['policyRows'] = [['a', 'b', 'c']]
): Flow => ({
  id: 'f',
  what: 'x',
  when: 'background',
  identifier: 'install_id',
  files: [],
  calls: [],
  policyRows: rows,
  stores: { apple: [], play: [], firefox: [], cws: [], ...over },
});

describe('diffStores', () => {
  it('reports additions and removals per store', () => {
    const before = [flow({ play: ['PSL_USER_ACCOUNT'], cws: ['User activity'] })];
    const after = [
      flow({
        play: ['PSL_PHOTOS'],
        cws: ['User activity'],
        apple: [
          { type: 'Photos or Videos', purpose: 'App Functionality', linked: true, tracking: false },
        ],
      }),
    ];
    const d = diffStores(before, after);
    expect(d.play).toEqual({ added: ['PSL_PHOTOS'], removed: ['PSL_USER_ACCOUNT'] });
    expect(d.apple.added).toEqual(['Photos or Videos — App Functionality, linked, not tracking']);
    expect(d.cws).toEqual({ added: [], removed: [] });
    expect(d.policyChanged).toBe(false);
  });

  it('notices a policy table change', () => {
    expect(diffStores([flow()], [flow({}, [['a', 'b', 'changed']])]).policyChanged).toBe(true);
  });

  it('with no baseline, asks for a full audit of every current value', () => {
    const d = diffStores(null, [flow({ play: ['PSL_EMAIL'], cws: ['Website content'] })]);
    expect(d.baseline).toBe(false);
    expect(d.play.added).toEqual(['PSL_EMAIL']);
    expect(d.cws.added).toEqual(['Website content']);
  });
});

describe('renderChecklist', () => {
  it('lists only the stores that changed, each with its owner', () => {
    const md = renderChecklist(
      diffStores([flow()], [flow({ play: ['PSL_PHOTOS'], cws: ['Website content'] })]),
      'v5.2.5'
    );
    expect(md.startsWith(BEGIN)).toBe(true);
    expect(md.endsWith(END)).toBe(true);
    expect(md).toMatch(/- \[ \] Play Data safety: \+ PSL_PHOTOS.*privacy:publish.*Claude/);
    expect(md).toMatch(/- \[ \] Chrome Web Store.*\+ Website content.*Dominik/);
    expect(md).not.toMatch(/App Store/);
  });

  it('says plainly when nothing changed, with nothing to tick', () => {
    const md = renderChecklist(diffStores([flow()], [flow()]), 'v5.2.5');
    expect(md).toMatch(/No store declaration changed since v5\.2\.5/);
    expect(md).not.toMatch(/- \[ \]/);
  });

  it('a changed Play CSV asks for a push even when the types are the same', () => {
    const d = { ...diffStores([flow()], [flow()]), playCsvChanged: true };
    expect(renderChecklist(d, 'v5.2.5')).toMatch(
      /- \[ \] Play Data safety: answers changed in the CSV/
    );
  });

  it('a policy change asks for the gist', () => {
    const md = renderChecklist(diffStores([flow()], [flow({}, [['x', 'y', 'z']])]), 'v5.2.5');
    expect(md).toMatch(/- \[ \] Privacy policy gist republished/);
  });
});

describe('uncheckedItems', () => {
  it('finds unticked items inside the block only', () => {
    const body = [
      '- [ ] outside, ignored',
      BEGIN,
      '- [x] Play Data safety: done',
      '- [ ] Chrome Web Store: + Website content',
      '- [X] App Store: done',
      END,
    ].join('\r\n');
    expect(uncheckedItems(body)).toEqual(['Chrome Web Store: + Website content']);
  });

  it('a body without the block has nothing unchecked', () => {
    expect(uncheckedItems('- [ ] something')).toEqual([]);
  });
});

describe('placeBlock', () => {
  const block = (items: string) => `${BEGIN}\n${items}\n${END}`;

  it('appends the block below the author summary', () => {
    expect(placeBlock('summary', block('- [ ] a'))).toBe(`summary\n\n${block('- [ ] a')}\n`);
  });

  it('replaces an old block and keeps ticks on items that survive', () => {
    const body = `summary\n${block('- [x] a\n- [ ] b')}\nfooter`;
    const out = placeBlock(body, block('- [ ] a\n- [ ] c'));
    expect(out).toBe(`summary\n${block('- [x] a\n- [ ] c')}\nfooter`);
  });
});
