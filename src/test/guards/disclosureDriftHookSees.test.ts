import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The disclosure-drift Stop hook (`.claude/hooks/disclosure-drift.mjs`) stops a
 * Claude turn that changes a data flow without updating privacy/disclosures.ts.
 * It reads the flows' file list out of that source with a regex, so a change to
 * the source's shape could make it see nothing and pass every turn. This test
 * imports the hook's real functions against the real source.
 *
 * Runtime URL for the same reason as treeParityHookSees.test.ts: the .mjs is not
 * in the TS program.
 */
const hookUrl = pathToFileURL(resolve('.claude/hooks/disclosure-drift.mjs')).href;

type Hook = {
  SOURCE: string;
  flowFiles: (sourceText: string) => Set<string>;
  dataFlowFiles: (changed: Iterable<string>, flowSet: Set<string>) => string[];
  buildReason: (files: string[]) => string;
  undeclared: (changed: Iterable<string>, sourceText: string) => string[];
};

const hook: Hook = await import(/* @vite-ignore */ hookUrl);
const flows = hook.flowFiles(readFileSync(resolve(hook.SOURCE), 'utf-8'));

describe('disclosure-drift hook', () => {
  it('sees the flows in the real source', () => {
    expect(flows.has('src/api/suggestions.ts')).toBe(true);
    expect(flows.has('src/api/feedback.ts')).toBe(true);
    expect(flows.size).toBeGreaterThan(5);
  });

  it('flags a flow file, a migration and the platform manifests', () => {
    const out = hook.dataFlowFiles(
      [
        'src/api/suggestions.ts',
        'supabase/migrations/20260926_x.sql',
        'ios/App/App/Info.plist',
        'wxt.config.ts',
        'src/components/Calendar/Day.tsx',
      ],
      flows
    );
    expect(out).toEqual([
      'ios/App/App/Info.plist',
      'src/api/suggestions.ts',
      'supabase/migrations/20260926_x.sql',
      'wxt.config.ts',
    ]);
  });

  it('ignores a turn that touches no data flow', () => {
    expect(hook.dataFlowFiles(['src/components/Calendar/Day.tsx', 'README.md'], flows)).toEqual([]);
  });

  it('asks when a data flow changed and the source did not', () => {
    const src = readFileSync(resolve(hook.SOURCE), 'utf-8');
    expect(hook.undeclared(['ios/App/App/Info.plist'], src)).toEqual(['ios/App/App/Info.plist']);
  });

  it('stays quiet when the source changed in the same turn', () => {
    const src = readFileSync(resolve(hook.SOURCE), 'utf-8');
    expect(hook.undeclared(['ios/App/App/Info.plist', hook.SOURCE], src)).toEqual([]);
  });

  it('names the files and both ways out', () => {
    const reason = hook.buildReason(['src/api/suggestions.ts']);
    expect(reason).toMatch(/src\/api\/suggestions\.ts/);
    expect(reason).toMatch(/privacy:generate/);
    expect(reason).toMatch(/will not ask twice/);
  });
});
