/**
 * Turns a raw DOM probe (see `scripts/shot.ts`) into a list of layout and
 * legibility defects. Pure and node-testable on purpose: every geometry bug in
 * the ExamsScreen rebuild was caught by measurement, never by reading code, so
 * the judging half of that measurement is kept where it can be unit-tested.
 *
 * The browser side only reads numbers — rects, resolved RGBA, font metrics.
 * All thresholds and decisions live here.
 */

import { compositeOver, contrastRatio, OPAQUE_WHITE, type Rgba } from './contrast';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProbeElement {
  /** Stable index within the probe, used to express ancestry. */
  idx: number;
  /** Indices of this element's ancestors, nearest-first. */
  ancestors: number[];
  sel: string;
  text: string;
  rect: Rect;
  /** Own resolved background-color, or null when unresolvable. */
  bg: Rgba | null;
  /** Ancestors' backgrounds, nearest-first, excluding this element's own. */
  bgChain: Rgba[];
  color: Rgba | null;
  fontSize: number;
  fontWeight: number;
  hasDirectText: boolean;
}

export interface ProbeResult {
  width: number;
  height: number;
  docScrollWidth: number;
  docClientWidth: number;
  /** The page's own backdrop, terminating every ancestor chain. Assuming white
   *  here would score light text on an unpainted container as illegible. */
  rootBg?: Rgba | null;
  elements: ProbeElement[];
}

export type FindingKind =
  | 'overflow'
  | 'overflow-element'
  | 'contrast-surface'
  | 'contrast-text'
  | 'collision';

export interface Finding {
  kind: FindingKind;
  sel: string;
  detail: string;
  severity: 'error' | 'warn';
}

/** Below this ratio two adjacent surfaces are indistinguishable on a real screen. */
export const MIN_SURFACE_RATIO = 1.05;
/** WCAG AA for body text, and for large text. */
export const MIN_TEXT_RATIO = 4.5;
export const MIN_LARGE_TEXT_RATIO = 3;
/** Sub-pixel slack — browsers routinely report fractional scroll widths. */
const PX_SLACK = 1;
/** Overlap beyond this share of the smaller box is a real collision, not a nudge. */
const COLLISION_OVERLAP_SHARE = 0.4;
/** Cap the per-run report so a systemic issue can't produce thousands of lines. */
const MAX_PER_KIND = 12;

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

function isOpaqueEnough(c: Rgba | null): c is Rgba {
  return c != null && c.a > 0.01;
}

/** Flatten an element's backdrop: first painted ancestor, composited over the
 *  page backdrop. Falls back to the page backdrop, then to white. */
function backdropOf(e: ProbeElement, root: Rgba | null | undefined): Rgba | null {
  const base = isOpaqueEnough(root) ? root : OPAQUE_WHITE;
  for (const c of e.bgChain) {
    if (isOpaqueEnough(c)) return c.a >= 1 ? c : compositeOver(c, base);
  }
  return isOpaqueEnough(root) ? root : null;
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return (
    Math.round(a.r) === Math.round(b.r) &&
    Math.round(a.g) === Math.round(b.g) &&
    Math.round(a.b) === Math.round(b.b) &&
    Math.abs(a.a - b.a) < 0.01
  );
}

/**
 * The surface text is actually drawn on: the element's own background when it
 * paints one (a chip, a badge, a button), otherwise the nearest painted
 * ancestor. Using the ancestor for an element that paints its own background
 * measures the wrong pair and wildly under-reports.
 */
function textBackdropOf(e: ProbeElement, root: Rgba | null | undefined): Rgba | null {
  const ancestor = backdropOf(e, root);
  if (!isOpaqueEnough(e.bg)) return ancestor;
  return compositeOver(e.bg, ancestor ?? OPAQUE_WHITE);
}

function isLargeText(e: ProbeElement): boolean {
  return e.fontSize >= 24 || (e.fontSize >= 18.66 && e.fontWeight >= 700);
}

function overlapShare(a: Rect, b: Rect): number {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox <= 0 || oy <= 0) return 0;
  const smaller = Math.min(area(a), area(b));
  return smaller === 0 ? 0 : (ox * oy) / smaller;
}

function overflowFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  const over = p.docScrollWidth - p.docClientWidth;
  if (over > PX_SLACK) {
    out.push({
      kind: 'overflow',
      sel: 'document',
      detail: `page scrolls ${Math.round(over)}px horizontally at ${p.width}px wide`,
      severity: 'error',
    });
    for (const e of p.elements) {
      const past = e.rect.x + e.rect.w - p.width;
      if (past > PX_SLACK && area(e.rect) > 0) {
        out.push({
          kind: 'overflow-element',
          sel: e.sel,
          detail: `extends ${Math.round(past)}px past the ${p.width}px viewport`,
          severity: 'error',
        });
      }
    }
  }
  return out;
}

function surfaceFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  for (const e of p.elements) {
    if (!isOpaqueEnough(e.bg) || area(e.rect) < 4) continue;
    const backdrop = backdropOf(e, p.rootBg);
    if (!backdrop) continue;
    // An element that reuses its backdrop's exact colour is composition, not a
    // mistake. Only a *different* colour that fails to read is a defect.
    if (sameColor(e.bg, backdrop)) continue;
    const painted = compositeOver(e.bg, backdrop);
    if (sameColor(painted, backdrop)) continue;
    const ratio = contrastRatio(painted, backdrop);
    if (ratio < MIN_SURFACE_RATIO) {
      out.push({
        kind: 'contrast-surface',
        sel: e.sel,
        detail: `surface is ${ratio.toFixed(3)}:1 against its backdrop — invisible (need ${MIN_SURFACE_RATIO})`,
        severity: 'warn',
      });
    }
  }
  return out;
}

function textFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  for (const e of p.elements) {
    if (!e.hasDirectText || !isOpaqueEnough(e.color)) continue;
    const backdrop = textBackdropOf(e, p.rootBg);
    if (!backdrop) continue;
    const fg = compositeOver(e.color, backdrop);
    const need = isLargeText(e) ? MIN_LARGE_TEXT_RATIO : MIN_TEXT_RATIO;
    const ratio = contrastRatio(fg, backdrop);
    if (ratio < need) {
      const label = e.text ? ` "${e.text.slice(0, 24)}"` : '';
      out.push({
        kind: 'contrast-text',
        sel: e.sel,
        detail: `text${label} is ${ratio.toFixed(2)}:1 (need ${need})`,
        severity: 'warn',
      });
    }
  }
  return out;
}

function collisionFindings(p: ProbeResult): Finding[] {
  const out: Finding[] = [];
  const texts = p.elements.filter((e) => e.hasDirectText && area(e.rect) > 0);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]!;
      const b = texts[j]!;
      // A descendant necessarily sits inside its ancestor — not a collision.
      if (a.ancestors.includes(b.idx) || b.ancestors.includes(a.idx)) continue;
      const share = overlapShare(a.rect, b.rect);
      if (share > COLLISION_OVERLAP_SHARE) {
        out.push({
          kind: 'collision',
          sel: `${a.sel} × ${b.sel}`,
          detail: `text boxes overlap by ${Math.round(share * 100)}%`,
          severity: 'error',
        });
      }
    }
  }
  return out;
}

function capPerKind(findings: Finding[]): Finding[] {
  const seen = new Map<FindingKind, number>();
  const out: Finding[] = [];
  for (const f of findings) {
    const n = (seen.get(f.kind) ?? 0) + 1;
    seen.set(f.kind, n);
    if (n <= MAX_PER_KIND) out.push(f);
    else if (n === MAX_PER_KIND + 1) {
      out.push({
        kind: f.kind,
        sel: '…',
        detail: `more ${f.kind} findings suppressed — fix these first`,
        severity: f.severity,
      });
    }
  }
  return out;
}

/** Judge a probe. Errors first, then warnings; both capped per kind. */
export function analyzeProbe(p: ProbeResult): Finding[] {
  const all = [
    ...overflowFindings(p),
    ...collisionFindings(p),
    ...surfaceFindings(p),
    ...textFindings(p),
  ];
  const rank = (f: Finding) => (f.severity === 'error' ? 0 : 1);
  return capPerKind(all.sort((a, b) => rank(a) - rank(b)));
}
