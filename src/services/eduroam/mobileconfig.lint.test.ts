import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateEduroamMobileconfig } from './mobileconfig';

function hasPlutil(): boolean {
  try {
    execFileSync('which', ['plutil']);
    return true;
  } catch {
    return false;
  }
}

// Skips automatically on non-macOS / CI without plutil.
describe.runIf(hasPlutil())('mobileconfig plutil validation', () => {
  it('emits a profile that plutil -lint accepts', () => {
    const xml = generateEduroamMobileconfig({
      rootCaDer: new Uint8Array([1, 2, 3, 4, 5]),
      clientP12: new Uint8Array([6, 7, 8, 9, 10]),
    });
    const dir = mkdtempSync(join(tmpdir(), 'reis-eduroam-'));
    const file = join(dir, 'test.mobileconfig');
    writeFileSync(file, xml);
    const out = execFileSync('plutil', ['-lint', file]).toString();
    expect(out).toContain('OK');
  });
});
