import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `text-warning-content` (and its error/success/info siblings) is the ink for
 * a SOLID `bg-warning` fill. It is not a "warning-coloured text" class.
 *
 * On a tint — `bg-warning/15` over base-100 — it is unreadable: #111827 on a
 * dark olive in the dark theme is invisible, which is what a student saw on
 * the phone's Předměty screen for "Management" at 20 %. Before
 * --color-warning-content was changed it was #ffffff, 1.15:1 on the pale tint
 * in the light theme. The desktop fail-rate pill drifted into this three times
 * (see SubjectsPanel/failRateTone.ts), and the phone SemesterCard, the Erasmus
 * panel and the exam auto-registration banner carried it after that.
 *
 * On a tint, text takes the tone token: `text-[var(--tone-warning)]`, which is
 * the hue darkened (light) or lightened (dark) to read on either base.
 *
 * The rule enforced: every string literal that sets `text-<status>-content`
 * also sets the solid `bg-<status>` it belongs to, in the same literal. That
 * also catches the case where the tint sits on a parent element and the ink on
 * a child, which is how ExamPanel's banner hid it.
 */
const STATUSES = ['warning', 'error', 'success', 'info'] as const;

function sourcesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(resolve(abs, name)).isDirectory())
      return name === '__tests__' ? [] : sourcesUnder(rel);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

/** A template's static text, each `${…}` removed (brace depth counted). */
function staticText(template: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < template.length; i++) {
    if (depth === 0 && template[i] === '$' && template[i + 1] === '{') {
      depth = 1;
      i++;
    } else if (depth > 0) {
      if (template[i] === '{') depth++;
      else if (template[i] === '}') depth--;
    } else out += template[i];
  }
  return out;
}

/**
 * Every class string, each on its own. Quoted strings are matched across the
 * whole source, so the branches of a ternary inside a template are checked
 * separately — otherwise a solid `bg-warning` in one branch would excuse
 * `text-warning-content` on a tint in the other. A template's own static text
 * is checked with its `${…}` removed, for the same reason.
 */
function literals(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const quoted = [...code.matchAll(/'[^'\n]*'|"[^"\n]*"/g)].map((m) => m[0]);
  const templates = [...code.matchAll(/`[^`]*`/g)].map((m) => staticText(m[0]));
  return [...quoted, ...templates];
}

export function inkOffSolidFill(src: string): string[] {
  const hits: string[] = [];
  for (const lit of literals(src)) {
    for (const s of STATUSES) {
      const ink = new RegExp(`(?:^|[\\s'"\`:])text-${s}-content(?:/\\d+)?(?=[\\s'"\`]|$)`);
      const solid = new RegExp(`(?:^|[\\s'"\`:])bg-${s}(?=[\\s'"\`]|$)`);
      if (ink.test(lit) && !solid.test(lit)) hits.push(`${s}: ${lit.trim()}`);
    }
  }
  return hits;
}

describe('status ink only on a solid status fill', () => {
  it('flags ink on a tint, ink with no fill at all, and passes the solid pair', () => {
    expect(inkOffSolidFill(`'bg-warning/15 text-warning-content'`)).toHaveLength(1);
    expect(inkOffSolidFill(`"text-xs text-warning-content/80"`)).toHaveLength(1);
    expect(inkOffSolidFill(`'bg-error/10 text-error-content'`)).toHaveLength(1);
    // One branch solid, the other a tint: the solid one must not excuse it.
    expect(
      inkOffSolidFill(
        "`px-1 ${a ? 'bg-warning text-warning-content' : 'bg-warning/15 text-warning-content'}`"
      )
    ).toHaveLength(1);
    expect(inkOffSolidFill('`bg-warning/15 text-warning-content ${x}`')).toHaveLength(1);
    expect(inkOffSolidFill(`'bg-warning text-warning-content border-warning/20'`)).toEqual([]);
    expect(inkOffSolidFill(`'hover:bg-warning/25 bg-warning text-warning-content'`)).toEqual([]);
    expect(inkOffSolidFill(`// text-warning-content on bg-warning/15 was invisible`)).toEqual([]);
  });

  it('holds across src/', () => {
    const offenders = sourcesUnder('src').flatMap((file) =>
      inkOffSolidFill(readFileSync(resolve(process.cwd(), file), 'utf8')).map(
        (hit) => `${file} → ${hit}`
      )
    );
    expect(offenders).toEqual([]);
  });
});
