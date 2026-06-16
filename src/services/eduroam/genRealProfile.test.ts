import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateEduroamMobileconfig } from './mobileconfig';

const dir = process.env.REIS_REAL_CERT_DIR;

// Set REIS_REAL_CERT_DIR to a folder containing root-der.der and user-p12.p12
// to emit an installable eduroam-reis.mobileconfig into that same folder.
describe.runIf(!!dir)('generate real eduroam profile (manual)', () => {
  it('writes eduroam-reis.mobileconfig from real cert files', () => {
    const root = new Uint8Array(readFileSync(join(dir!, 'root-der.der')));
    const p12 = new Uint8Array(readFileSync(join(dir!, 'user-p12.p12')));
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12 });
    writeFileSync(join(dir!, 'eduroam-reis.mobileconfig'), xml);
    // eslint-disable-next-line no-console
    console.log('Wrote', join(dir!, 'eduroam-reis.mobileconfig'));
  });
});
