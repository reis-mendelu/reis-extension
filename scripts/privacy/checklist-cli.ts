// Prints the release PR's privacy block: tsx scripts/privacy/checklist-cli.ts <base ref> <head ref>
// <base ref> is the last v* tag. When privacy/disclosures.ts does not exist there,
// the block asks for a one-time audit of every store instead of a diff.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Flow } from '../../privacy/disclosures';
import { diffStores } from './diff';
import { renderChecklist } from './checklist';

const show = (ref: string, path: string): string | null => {
  if (!ref) return null;
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

async function flowsAt(ref: string): Promise<Flow[] | null> {
  const text = show(ref, 'privacy/disclosures.ts');
  if (text === null) return null;
  const file = join(mkdtempSync(join(tmpdir(), 'reis-disclosures-')), 'disclosures.ts');
  writeFileSync(file, text);
  const mod = (await import(pathToFileURL(file).href)) as { FLOWS: Flow[] };
  return mod.FLOWS;
}

export async function buildBlock(base: string, head: string): Promise<string> {
  const after = await flowsAt(head);
  if (!after) throw new Error(`privacy/disclosures.ts not found at ${head}`);
  const diff = diffStores(await flowsAt(base), after);
  diff.playCsvChanged =
    show(base, 'privacy/play-data-safety.csv') !== show(head, 'privacy/play-data-safety.csv');
  return renderChecklist(diff, base || '(no earlier tag)');
}

if (process.argv[1]?.endsWith('checklist-cli.ts')) {
  const [base = '', head = 'HEAD'] = process.argv.slice(2);
  process.stdout.write((await buildBlock(base, head)) + '\n');
}
