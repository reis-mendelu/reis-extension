import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FEATURE_SIGNALS } from '../featureUsage';
import { SIGNAL_LABEL_KEY } from '../../components/AdminConsole/featureSignalLabels';
import cs from '../../i18n/locales/cs.json';
import en from '../../i18n/locales/en.json';

/**
 * `track_feature_usage` DROPS a label it does not know, without an error, so a
 * client label missing from the database whitelist is not a failure anyone
 * sees: the counter just stays at zero, and zero reads as "nobody did it".
 * This pins the client's labels to the whitelist the newest migration sets —
 * in both places it lives, the function and the column check.
 */
const DIR = 'supabase/migrations';

function lastWhitelist(pattern: RegExp): string[] {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let found: string[] | null = null;
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), 'utf8');
    for (const m of sql.matchAll(pattern)) {
      found = [...(m[1] ?? m[2])!.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]!);
    }
  }
  if (!found) throw new Error(`no whitelist matching ${pattern} in ${DIR}`);
  return [...found].sort();
}

describe('feature signal whitelist', () => {
  const client = [...FEATURE_SIGNALS].sort();

  it('the function accepts every label the client sends', () => {
    expect(lastWhitelist(/p_feature not in \(([^)]*)\)/g)).toEqual(client);
  });

  it('the column check accepts every label the client sends', () => {
    // A hand-written migration says `check (feature in (...))`; the baseline is
    // a schema dump and says `CHECK (("feature" = ANY (ARRAY[...])))`.
    expect(
      lastWhitelist(/check \(feature in \(([^)]*)\)\)|"feature" = ANY \(ARRAY\[([^\]]*)\]/gi)
    ).toEqual(client);
  });

  it('the admin console has a label for every signal, in both languages', () => {
    for (const signal of FEATURE_SIGNALS) {
      const key = SIGNAL_LABEL_KEY[signal];
      expect(key, signal).toBeTruthy();
      expect((cs.admin.stats as Record<string, string>)[key], `cs ${key}`).toBeTruthy();
      expect((en.admin.stats as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
  });
});
