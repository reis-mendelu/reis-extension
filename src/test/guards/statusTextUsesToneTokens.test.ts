import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A status hue used as TEXT takes its tone token — `text-[var(--tone-success)]`,
 * never raw `text-success`.
 *
 * The raw hues are built as fills. As glyphs on the light theme they measured
 * 1.86–2.28:1 (green) and 3.47–3.9:1 (red) against base-100 or their own /15
 * tint, which is how the phone Exams screen came to spell every date, seat count
 * and the "4 přihlášené" badge in a colour nobody could read. `--tone-*`
 * (src/index.css) is the same hue darkened in light and left or lifted in dark,
 * so the design — coloured text on a whisper of tint — survives and passes AA.
 * An opacity step on top (`text-warning/90`) undoes it, so that is banned too.
 *
 * Scoped to the surfaces that were swept clean on 2026-09-24, not all of src/:
 * there are ~270 other raw uses, many of them icons on dark-only surfaces, and
 * each one needs measuring rather than a blind swap. Add a directory here once
 * it has been swept.
 */
const SWEPT = [
  'src/components/mobile/screens/exams',
  'src/components/mobile/screens/ExamsScreen.tsx',
  'src/components/mobile/screens/calendar/DayChips.tsx',
  'src/components/mobile/screens/ProfileScreen.tsx',
  'src/components/mobile/screens/HeaderActions.tsx',
  // desktop tree (the extension)
  'src/components/Exams/Timeline/ExamItem.tsx',
  'src/components/ExamPanel/TermsSummary.tsx',
  'src/components/ExamPanel/ExamSectionCard.tsx',
  'src/components/ExamPanel/TermNoteBlock.tsx',
  'src/components/Bulletin/BulletinBanner.tsx',
];

const RAW = /(?:^|[\s'"`:])text-(success|error|warning|info|primary)(?:\/\d+)?(?=[\s'"`]|$)/gm;

function sources(path: string): string[] {
  const abs = resolve(process.cwd(), path);
  if (!statSync(abs).isDirectory()) return [path];
  return readdirSync(abs).flatMap((name) => {
    if (name === '__tests__') return [];
    const rel = join(path, name);
    if (statSync(resolve(abs, name)).isDirectory()) return sources(rel);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

export function rawStatusText(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(RAW)].map((m) => m[0].trim());
}

describe('status text uses the tone tokens', () => {
  it('flags raw and opacity-stepped hues, passes the token and non-text uses', () => {
    expect(rawStatusText(`'font-bold text-success'`)).toHaveLength(1);
    expect(rawStatusText('`${a ? "text-error" : "x"}`')).toHaveLength(1);
    expect(rawStatusText(`"leading-tight text-warning/90"`)).toHaveLength(1);
    expect(rawStatusText(`'hover:text-primary'`)).toHaveLength(1);
    expect(rawStatusText(`'text-[var(--tone-success)] bg-success/15'`)).toEqual([]);
    expect(rawStatusText(`'border-error/35 bg-primary/15 text-success-content'`)).toEqual([]);
    expect(rawStatusText(`// raw text-success measured 2.28:1`)).toEqual([]);
  });

  it('holds on every swept surface', () => {
    const offenders = SWEPT.flatMap(sources).flatMap((file) =>
      rawStatusText(readFileSync(resolve(process.cwd(), file), 'utf8')).map(
        (hit) => `${file} → ${hit}`
      )
    );
    expect(offenders).toEqual([]);
  });
});
