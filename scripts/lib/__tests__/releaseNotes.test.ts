import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReleaseNotes, releaseNotesPath } from '../releaseNotes';

function repoWith(version: string, text: string | null): string {
  const root = mkdtempSync(join(tmpdir(), 'reis-notes-'));
  mkdirSync(join(root, 'release-notes'));
  if (text !== null) writeFileSync(join(root, releaseNotesPath(version)), text);
  return root;
}

describe('loadReleaseNotes', () => {
  it('reads the agreed Czech text for a version, trimmed', () => {
    const root = repoWith('5.4.1', '  Rozvrh je znovu jen po dnech.\n');
    expect(loadReleaseNotes('5.4.1', root)).toBe('Rozvrh je znovu jen po dnech.');
  });

  it('refuses a release with no notes file, naming the path to create', () => {
    const root = repoWith('5.4.1', null);
    expect(() => loadReleaseNotes('5.4.1', root)).toThrow(/release-notes\/5\.4\.1\.cs\.txt/);
  });

  it('refuses an empty file: nothing is submitted without agreed copy', () => {
    const root = repoWith('5.4.1', '   \n');
    expect(() => loadReleaseNotes('5.4.1', root)).toThrow(/empty/);
  });

  it('refuses text Google Play would reject (500 characters per language)', () => {
    const root = repoWith('5.4.1', 'x'.repeat(501));
    expect(() => loadReleaseNotes('5.4.1', root)).toThrow(/500/);
  });

  it('refuses anything that is not a plain x.y.z version', () => {
    const root = repoWith('5.4.1', 'ok');
    expect(() => loadReleaseNotes('../etc/passwd', root)).toThrow(/version/);
  });
});
