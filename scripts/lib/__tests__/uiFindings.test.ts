import { describe, it, expect } from 'vitest';
import { analyzeProbe, type ProbeElement, type ProbeResult } from '../uiFindings';
import { parseCssColor } from '../contrast';

const BASE_200 = parseCssColor('#0f172a')!;
const BASE_300 = parseCssColor('#111827')!;
const SLATE_700 = parseCssColor('#334155')!;
const WHITE = parseCssColor('#ffffff')!;

function el(over: Partial<ProbeElement> = {}): ProbeElement {
  return {
    idx: 0,
    ancestors: [],
    sel: 'div',
    text: '',
    rect: { x: 0, y: 0, w: 100, h: 20 },
    bg: null,
    bgChain: [BASE_200],
    color: null,
    fontSize: 14,
    fontWeight: 400,
    hasDirectText: false,
    ...over,
  };
}

function probe(elements: ProbeElement[], over: Partial<ProbeResult> = {}): ProbeResult {
  return {
    width: 390,
    height: 844,
    docScrollWidth: 390,
    docClientWidth: 390,
    elements,
    ...over,
  };
}

const kinds = (f: { kind: string }[]) => f.map((x) => x.kind);

describe('analyzeProbe — horizontal overflow', () => {
  it('reports nothing when the document fits', () => {
    expect(analyzeProbe(probe([]))).toEqual([]);
  });

  it('flags a document wider than its viewport', () => {
    const f = analyzeProbe(probe([], { docScrollWidth: 430, docClientWidth: 390 }));
    expect(kinds(f)).toContain('overflow');
    expect(f[0]!.detail).toMatch(/40px/);
  });

  it('ignores sub-pixel overflow from rounding', () => {
    const f = analyzeProbe(probe([], { docScrollWidth: 390.4, docClientWidth: 390 }));
    expect(kinds(f)).not.toContain('overflow');
  });

  it('names the element that sticks out past the viewport', () => {
    const f = analyzeProbe(
      probe([el({ sel: 'div.exam-rail', rect: { x: 300, y: 0, w: 200, h: 20 }, bg: SLATE_700 })], {
        docScrollWidth: 500,
        docClientWidth: 390,
      })
    );
    expect(f.some((x) => x.kind === 'overflow-element' && x.sel === 'div.exam-rail')).toBe(true);
  });
});

describe('analyzeProbe — surface contrast', () => {
  // The bug found three times in one session: a different token that is not
  // actually different to the eye.
  it('flags base-300 painted on base-200 in the dark theme', () => {
    const f = analyzeProbe(probe([el({ sel: 'div.rail', bg: BASE_300, bgChain: [BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
    expect(f[0]!.detail).toMatch(/1\.0/);
  });

  // Nesting containers that share a token is normal composition, not a defect.
  // Only a *different* colour that fails to read is a mistake.
  it('ignores an element whose background matches its backdrop exactly', () => {
    const f = analyzeProbe(probe([el({ bg: BASE_200, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('accepts a surface that genuinely lifts off its backdrop', () => {
    const f = analyzeProbe(probe([el({ bg: SLATE_700, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('composites alpha before judging, so a faint tint still fails', () => {
    const faint = { ...SLATE_700, a: 0.04 };
    const f = analyzeProbe(probe([el({ bg: faint, bgChain: [BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
  });

  it('skips fully transparent backgrounds', () => {
    const f = analyzeProbe(probe([el({ bg: { r: 0, g: 0, b: 0, a: 0 }, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('skips zero-area elements', () => {
    const f = analyzeProbe(
      probe([el({ bg: BASE_300, bgChain: [BASE_200], rect: { x: 0, y: 0, w: 0, h: 0 } })])
    );
    expect(kinds(f)).not.toContain('contrast-surface');
  });

  it('falls through a transparent ancestor to the first painted backdrop', () => {
    const transparent = { r: 0, g: 0, b: 0, a: 0 };
    const f = analyzeProbe(probe([el({ bg: BASE_300, bgChain: [transparent, BASE_200] })]));
    expect(kinds(f)).toContain('contrast-surface');
  });
});

describe('analyzeProbe — text contrast', () => {
  it('flags body text below the AA 4.5:1 threshold', () => {
    const f = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'ZKO', color: BASE_300, bgChain: [BASE_200] })])
    );
    expect(kinds(f)).toContain('contrast-text');
  });

  it('passes white body text on a dark surface', () => {
    const f = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'ZKO', color: WHITE, bgChain: [BASE_200] })])
    );
    expect(kinds(f)).not.toContain('contrast-text');
  });

  it('applies the relaxed 3:1 threshold to large text', () => {
    // A grey that lands between 3:1 and 4.5:1 on this backdrop.
    const grey = parseCssColor('#6b7280')!;
    const small = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'x', color: grey, bgChain: [BASE_200], fontSize: 14 })])
    );
    const large = analyzeProbe(
      probe([el({ hasDirectText: true, text: 'x', color: grey, bgChain: [BASE_200], fontSize: 28 })])
    );
    expect(kinds(small)).toContain('contrast-text');
    expect(kinds(large)).not.toContain('contrast-text');
  });

  it('treats bold 18.66px+ as large text', () => {
    const grey = parseCssColor('#6b7280')!;
    const f = analyzeProbe(
      probe([
        el({
          hasDirectText: true,
          text: 'x',
          color: grey,
          bgChain: [BASE_200],
          fontSize: 19,
          fontWeight: 700,
        }),
      ])
    );
    expect(kinds(f)).not.toContain('contrast-text');
  });

  it('ignores elements with no direct text', () => {
    const f = analyzeProbe(probe([el({ hasDirectText: false, color: BASE_300, bgChain: [BASE_200] })]));
    expect(kinds(f)).not.toContain('contrast-text');
  });
});

describe('analyzeProbe — collision', () => {
  const a = el({
    idx: 1,
    sel: 'span.date',
    hasDirectText: true,
    text: '12.02.',
    rect: { x: 0, y: 0, w: 100, h: 20 },
  });

  it('flags two text elements that substantially overlap', () => {
    const b = el({
      idx: 2,
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 10, y: 2, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, b])))).toContain('collision');
  });

  it('ignores merely adjacent text', () => {
    const b = el({
      idx: 2,
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 101, y: 0, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, b])))).not.toContain('collision');
  });

  it('ignores an ancestor/descendant pair that necessarily overlaps', () => {
    const child = el({
      idx: 2,
      ancestors: [1],
      sel: 'span.title',
      hasDirectText: true,
      text: 'Zkouška',
      rect: { x: 0, y: 0, w: 100, h: 20 },
    });
    expect(kinds(analyzeProbe(probe([a, child])))).not.toContain('collision');
  });
});

describe('analyzeProbe — output shape', () => {
  it('sorts errors before warnings', () => {
    const f = analyzeProbe(
      probe([el({ bg: BASE_300, bgChain: [BASE_200] })], {
        docScrollWidth: 500,
        docClientWidth: 390,
      })
    );
    const firstWarn = f.findIndex((x) => x.severity === 'warn');
    const lastError = f.map((x) => x.severity).lastIndexOf('error');
    expect(firstWarn === -1 || lastError < firstWarn).toBe(true);
  });
});
