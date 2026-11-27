import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STUDY_AIDS } from '../../data/studyAids';
import { SIGNAL_LABEL_KEY } from '../../components/AdminConsole/featureSignalLabels';
import cs from '../../i18n/locales/cs.json';
import en from '../../i18n/locales/en.json';

/**
 * A link under Předměty shown to some students only (`src/data/studyAids.ts`:
 * mendelu.app, the programme Discord servers) needs the same handful of pieces
 * in six places, and a missing one fails silently: no seeded row shows the link
 * to nobody, a host outside the allow-list escapes the privacy filing, a counter
 * nobody discloses is a store-form lie. This names, per entry, what it still
 * needs, so adding the next link is "make this test pass".
 *
 * The counter's database whitelist is pinned separately and for every label by
 * `api/__tests__/featureSignalWhitelist.test.ts`.
 *
 * WHO sees a link stays data: its `study_aids` row (audience, is_active), edited
 * in the admin console. Retargeting or removing one is never a code change.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const migrations = readdirSync(resolve(ROOT, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => read(join('supabase/migrations', f)))
  .join('\n');
const allowedHosts = read('src/test/guards/noStudentDataLeaves.test.ts');
const disclosures = read('privacy/disclosures.ts');
const privacyMd = read('PRIVACY.md');

const lookup = (dict: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);

describe.each(STUDY_AIDS.map((e) => [e.id, e] as const))('link under Předměty: %s', (id, entry) => {
  const host = new URL(entry.url).hostname.replace(/^www\./, '');

  it('has its study_aids row seeded by a migration (no row = shown to nobody)', () => {
    const seeded = new RegExp(
      `insert into public\\.study_aids[\\s\\S]*?\\(\\s*'${id}'\\s*,`,
      'i'
    ).test(migrations);
    expect(seeded, `no migration inserts '${id}' into public.study_aids`).toBe(true);
  });

  it('has an admin-console label for its counter, in both languages', () => {
    const key = SIGNAL_LABEL_KEY[entry.clickSignal];
    expect(key, `SIGNAL_LABEL_KEY.${entry.clickSignal}`).toBeTruthy();
    expect((cs.admin.stats as Record<string, string>)[key]).toBeTruthy();
    expect((en.admin.stats as Record<string, string>)[key]).toBeTruthy();
  });

  it('discloses its counter in privacy/disclosures.ts', () => {
    expect(disclosures, `\`${entry.clickSignal}\` is not named in disclosures.ts`).toContain(
      entry.clickSignal
    );
  });

  it('links to a host the privacy guard allows and PRIVACY.md names', () => {
    expect(allowedHosts, `'${host}' is not in ALLOWED_HOSTS`).toContain(`'${host}'`);
    expect(privacyMd, `PRIVACY.md does not name ${host}`).toContain(host);
  });

  it('says what it is in both languages', () => {
    for (const key of [entry.labelKey, entry.hintKey]) {
      expect(lookup(cs, key), `cs ${key}`).toEqual(expect.any(String));
      expect(lookup(en, key), `en ${key}`).toEqual(expect.any(String));
    }
  });
});

describe('the study-aids registry', () => {
  it('gives every link its own id and its own counter', () => {
    const ids = STUDY_AIDS.map((e) => e.id);
    const signals = STUDY_AIDS.map((e) => e.clickSignal);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(signals).size).toBe(signals.length);
  });
});
