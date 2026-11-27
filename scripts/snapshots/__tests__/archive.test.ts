import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordDay, type DayInput } from '../archive';

const page = (body: string) => `<div class="mainpage">${body}</div>`;

describe('recordDay', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'snapshots-'));
  });

  const run = (date: string, pages: Record<string, string>, problems: string[] = []) =>
    recordDay(root, {
      date,
      time: '07:00',
      captures: Object.entries(pages).map(([key, html]) => ({ key, html })),
      problems,
    } satisfies DayInput);

  it('saves every page on the first day and logs one line for them', () => {
    const r = run('2026-11-28', { 'is/index': page('<p>Vývěska</p>') });
    expect(r.changed).toEqual(['is/index']);
    expect(readFileSync(join(root, 'days/2026-11-28/is/index.txt'), 'utf8')).toBe('Vývěska\n');
    expect(existsSync(join(root, 'days/2026-11-28/is/index.html'))).toBe(true);
    const log = readFileSync(join(root, 'changes.md'), 'utf8');
    expect(log).toContain('## 2026-11-28 07:00');
    expect(log).toContain('first snapshot: is/index');
  });

  it('saves nothing for a page whose text did not change, even if its markup did', () => {
    run('2026-11-28', { 'is/index': page('<p>Vývěska</p>') });
    const r = run('2026-11-29', { 'is/index': page('<p class="x">Vývěska</p><script>1</script>') });
    expect(r.changed).toEqual([]);
    expect(existsSync(join(root, 'days/2026-11-29/is/index.txt'))).toBe(false);
    expect(readFileSync(join(root, 'changes.md'), 'utf8')).toContain('no changes');
  });

  it('logs the added lines of a changed page, so a grep for them finds the day', () => {
    run('2026-11-28', { 'webiskam/InformaceOKlientovi': page('<p>Konto</p>') });
    const r = run('2026-12-03', {
      'webiskam/InformaceOKlientovi': page('<p>Konto</p><p>Nájemné prosinec 5 370 Kč</p>'),
    });
    expect(r.changed).toEqual(['webiskam/InformaceOKlientovi']);
    const log = readFileSync(join(root, 'changes.md'), 'utf8');
    expect(log).toMatch(
      /## 2026-12-03 07:00[\s\S]*webiskam\/InformaceOKlientovi: \+1 −0 → days\/2026-12-03\/webiskam\/InformaceOKlientovi\.txt\n {2}\+ Nájemné prosinec 5 370 Kč/
    );
  });

  it('counts removed lines too (a paid claim disappears)', () => {
    run('2026-12-03', { 'webiskam/x': page('<p>Konto</p><p>Nájemné 5 370 Kč</p>') });
    run('2026-12-05', { 'webiskam/x': page('<p>Konto</p>') });
    expect(readFileSync(join(root, 'changes.md'), 'utf8')).toContain('webiskam/x: +0 −1');
  });

  it('writes problems into the log, so a failed morning is visible later', () => {
    run('2026-11-28', {}, ['WebISKAM: alibaba wants consent first']);
    expect(readFileSync(join(root, 'changes.md'), 'utf8')).toContain(
      '- ⚠ WebISKAM: alibaba wants consent first'
    );
  });

  it('keeps the state across runs in state.json', () => {
    run('2026-11-28', { 'is/a': page('<p>1</p>') });
    const state = JSON.parse(readFileSync(join(root, 'state.json'), 'utf8')) as {
      pages: Record<string, { saved: string; seen: string }>;
    };
    expect(state.pages['is/a']).toMatchObject({ saved: '2026-11-28', seen: '2026-11-28' });
  });
});
