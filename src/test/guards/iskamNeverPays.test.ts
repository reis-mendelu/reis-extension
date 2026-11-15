import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenDialogScript, buildProbeScript } from '../../mobile/iskam/payScript';

/**
 * reIS shows a student's open WebISKAM claims and opens WebISKAM's own
 * "Uhradit" dialog for one, but it never pays (Dominik, 2026-11-15: "we try
 * not to handle the payments ourselves", the same as the ISIC top-up, which
 * hands the student to GoPay's page). Paying is the student's tap on
 * WebISKAM's button, in WebISKAM's page.
 *
 * Pinned in two places:
 * 1. No code under src/ names WebISKAM's pay endpoint, so nothing can request it.
 * 2. The script injected into WebISKAM's page sends no form and presses only
 *    the € button that opens the dialog, never the dialog's own button.
 *
 * If this ever has to change, it changes the product's promise first: the
 * privacy policy says reIS reads WebISKAM and starts top-ups, nothing more.
 */
const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'test') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(relative(root, p).split(sep).join('/'));
    }
  }
  return out;
}

const ID = '00000000-0000-0000-0000-000000000001';

describe('reIS never pays a WebISKAM claim', () => {
  it('no source names the pay endpoint', () => {
    const PAY = /InformaceOKlientovi\/ZaplatitZKonta|IDPolozky\s*=|['"]IDPolozky['"]\s*[,:]/;
    const offenders = walk(join(root, 'src')).filter((f) =>
      PAY.test(readFileSync(join(root, f), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('the injected scripts send nothing and press only the € opener', () => {
    const code = buildOpenDialogScript(ID) + buildProbeScript(ID);
    expect(code).not.toMatch(
      /submit|requestSubmit|fetch\(|XMLHttpRequest|\$\.(ajax|post)|\.post\(/i
    );
    expect(code).not.toMatch(/input\[type/i);
    const clicks = [...code.matchAll(/\.click\(\)/g)];
    expect(clicks).toHaveLength(1);
    expect(code).toContain('.payfrommainaccount[data-id=');
  });
});
