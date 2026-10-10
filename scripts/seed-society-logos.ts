/**
 * One-off: rasterize the eight existing society logos to 256×256 PNG, upload
 * them to the society-logos bucket, and print the SQL that points each
 * societies row at its file. Run ONCE, after the migration, by hand. See
 * docs/runbooks/societies-catalog-rollout.md.
 *
 * Uploads through `npx supabase storage cp --linked`, which uses the linked
 * project's service credentials, so no admin password is needed. It prints SQL
 * rather than running it, so a human reads it before prod changes.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOURCES: Record<string, string> = {
  esn: 'scripts/society-logos/esn.jpg',
  supef: 'scripts/society-logos/supef.jpg',
  au_frrms: 'scripts/society-logos/au_frrms.jpg',
  usaf: 'scripts/society-logos/usaf.jpg',
  ldf: 'scripts/society-logos/ldf.jpg',
  zf: 'scripts/society-logos/zf.jpg',
  ey: 'scripts/society-logos/ey.svg',
  reis: 'public/reIS_logo.svg',
};

const MIME: Record<string, string> = { jpg: 'image/jpeg', svg: 'image/svg+xml' };
const SIDE = 256;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const out = mkdtempSync(join(tmpdir(), 'society-logos-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIDE, height: SIDE } });
  const sql: string[] = [];

  for (const [id, file] of Object.entries(SOURCES)) {
    const ext = file.split('.').pop()!;
    const dataUrl = `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
    // Centre-crop to a square, the same framing encodeSocietyLogo gives an upload.
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
         <img src="${dataUrl}" style="width:${SIDE}px;height:${SIDE}px;object-fit:cover;display:block">
       </body></html>`
    );
    await page.waitForFunction(() => document.images[0]?.complete);
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 32);
    const objectPath = `${id}/${hash}.png`;
    const local = join(out, `${id}.png`);
    writeFileSync(local, png);
    if (!dryRun) {
      execFileSync(
        'npx',
        [
          'supabase',
          'storage',
          'cp',
          '--linked',
          '--experimental',
          '--content-type',
          'image/png',
          '--cache-control',
          'max-age=31536000',
          local,
          `ss:///society-logos/${objectPath}`,
        ],
        { stdio: 'inherit' }
      );
    }
    sql.push(`update public.societies set logo_path = '${objectPath}' where id = '${id}';`);
  }

  await browser.close();
  console.log(`\nPNGs in ${out}. Review them, then apply:\n\nbegin;\n${sql.join('\n')}\ncommit;\n`);
}

void main();
