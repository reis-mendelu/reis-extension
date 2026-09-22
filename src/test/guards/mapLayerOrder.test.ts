import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  LEAFLET_PANE_Z,
  LEAFLET_PANE_NAMES,
  REIS_PANE_Z,
  LABELS_PANE,
  EVENTS_PANE,
} from '../../components/CampusMap/mapPanes';

/**
 * CI fence for the campus map's paint order.
 *
 * The bug it exists for: `EventLayer` pinned its pane at a bare `640`, Leaflet's
 * tooltip pane sits at 650, and every lettered building name is a Leaflet
 * tooltip — so the letters drew straight through an event pin's hover bubble.
 * Nothing caught it, because the two numbers lived in different files and one of
 * them was in `node_modules`.
 *
 * Note what a screenshot-free unit test CANNOT do here: jsdom loads no
 * stylesheet, so `getComputedStyle(pane).zIndex` is `auto` for every pane and a
 * test that compared computed values would pass while the map was visibly
 * broken. These checks therefore compare DECLARED numbers, and read Leaflet's
 * own from its shipped stylesheet rather than trusting a copy of it.
 */

const ROOT = join(__dirname, '../../..');
const SRC = join(ROOT, 'src');
const LEAFLET_CSS = join(ROOT, 'node_modules/leaflet/dist/leaflet.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/__tests__|\.test\./.test(full)) out.push(full);
  }
  return out;
}
const SOURCES = walk(SRC).map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf8') }));

/** The `{ … }` literal that encloses `text[at]`, or null if there is none. */
function enclosingObject(text: string, at: number): string | null {
  let depth = 0;
  let open = -1;
  for (let i = at; i >= 0; i--) {
    if (text[i] === '}') depth++;
    else if (text[i] === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open < 0) return null;
  depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return null;
}

describe('campus map layer order', () => {
  it("matches Leaflet's own pane z-indexes, read from its stylesheet", () => {
    const css = readFileSync(LEAFLET_CSS, 'utf8');
    const fromCss = new Map<string, number>();
    for (const m of css.matchAll(/\.leaflet-(\w+)-pane\s*\{\s*z-index:\s*(\d+)/g))
      fromCss.set(m[1]!, Number(m[2]!));
    const asShipped = Object.fromEntries(
      Object.keys(LEAFLET_PANE_Z).map((k) => [k, fromCss.get(k)])
    );
    // A Leaflet upgrade that renumbers a pane has to be noticed here, not by a
    // student seeing a letter through a hover bubble.
    expect(asShipped).toEqual({ ...LEAFLET_PANE_Z });
  });

  it('puts every reIS pane on the intended side of the Leaflet ones', () => {
    const labels = REIS_PANE_Z[LABELS_PANE];
    const events = REIS_PANE_Z[EVENTS_PANE];
    // Annotation sits above the markers it annotates …
    expect(labels).toBeGreaterThan(LEAFLET_PANE_Z.marker);
    // … and below the content drawn on top of the map. THIS is the regression.
    expect(events).toBeGreaterThan(labels);
    // A user-invoked label (a gate name on hover, a route chip) still wins.
    expect(events).toBeLessThan(LEAFLET_PANE_Z.tooltip);
    // Nothing reIS owns may outrank a popup.
    for (const z of Object.values(REIS_PANE_Z)) expect(z).toBeLessThan(LEAFLET_PANE_Z.popup);
  });

  it('makes every permanent tooltip name the pane it belongs to', () => {
    const offenders: string[] = [];
    for (const { path, text } of SOURCES) {
      for (const m of text.matchAll(/\bpermanent:/g)) {
        const obj = enclosingObject(text, m.index!);
        if (obj && !/\bpane:/.test(obj)) offenders.push(`${path}: ${obj.replace(/\s+/g, ' ')}`);
      }
    }
    // A permanent tooltip is map furniture and its layer is a decision. Leaving
    // it to Leaflet's default puts it above the event pins, which is the one
    // answer that has already been wrong.
    expect(offenders).toEqual([]);
  });

  it('never hardcodes a reIS pane name', () => {
    const known = new Set<string>(LEAFLET_PANE_NAMES);
    const offenders: string[] = [];
    for (const { path, text } of SOURCES)
      for (const m of text.matchAll(/\bpane:\s*'([^']+)'/g))
        if (!known.has(m[1]!)) offenders.push(`${path}: pane: '${m[1]}'`);
    // reIS panes are referenced through LABELS_PANE / EVENTS_PANE so the name
    // and its z-index cannot drift apart.
    expect(offenders).toEqual([]);
  });

  it('gives every map the reIS panes before anything binds into one', () => {
    // Leaflet does not check: a tooltip whose `pane` the map has not got makes
    // `getPane()` return undefined and then appends a child to it, which throws.
    // So whoever builds a map owns creating the panes.
    const makers = SOURCES.filter((s) => /\bL\.map\(/.test(s.text));
    expect(makers.length).toBeGreaterThan(0);
    expect(makers.filter((s) => !/ensureReisPanes\(/.test(s.text)).map((s) => s.path)).toEqual([]);
  });

  it('decides pane z-indexes in exactly one file', () => {
    const offenders = SOURCES.filter(
      (s) =>
        s.path !== 'src/components/CampusMap/mapPanes.ts' &&
        (/createPane\(/.test(s.text) || /style\.zIndex\s*=/.test(s.text))
    ).map((s) => s.path);
    expect(offenders).toEqual([]);
  });
});
