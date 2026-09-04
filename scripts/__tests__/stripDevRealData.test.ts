import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEV_REAL_DATA_FILENAME, stripDevRealDataFile } from '../stripDevRealData.mjs';

describe('stripDevRealDataFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'reis-web-build-'));
  });

  afterEach(() => {
    // Undo any permission lockdown a test applied before the recursive cleanup,
    // otherwise rmSync itself would hit the same EACCES the test induced.
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  });

  it('deletes the file when present, mirroring the extension build:publicAssets strip', () => {
    writeFileSync(join(dir, DEV_REAL_DATA_FILENAME), '{"fake":"snapshot"}');

    stripDevRealDataFile(dir);

    expect(existsSync(join(dir, DEV_REAL_DATA_FILENAME))).toBe(false);
  });

  it('is a no-op when the file is already absent', () => {
    expect(() => stripDevRealDataFile(dir)).not.toThrow();
  });

  it('leaves unrelated build output untouched', () => {
    writeFileSync(join(dir, DEV_REAL_DATA_FILENAME), '{}');
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'reIS_logo_128.png'), 'fake-png-bytes');

    stripDevRealDataFile(dir);

    expect(existsSync(join(dir, 'index.html'))).toBe(true);
    expect(existsSync(join(dir, 'reIS_logo_128.png'))).toBe(true);
  });

  it('fails loudly, naming the file, if the removal attempt does not actually remove it', () => {
    writeFileSync(join(dir, DEV_REAL_DATA_FILENAME), '{"fake":"snapshot"}');
    // Deleting a file requires write permission on its *directory*, not the
    // file itself. Locking the directory down reproduces "the delete step
    // ran but the file is still there" without needing to mock fs.
    chmodSync(dir, 0o555);

    expect(() => stripDevRealDataFile(dir)).toThrow(/dev-real-data\.json/);
  });
});
