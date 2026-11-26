// The "changed" lines the ledger adds to an overview (step 4b of the map): when a file in
// the diff was replaced or has gone from IS, the entries whose date came from it are named
// next to it, so the student is not told "file replaced" while the date they were given
// quietly stays. The standing mark is on the entry itself (ledgerSource.recheckReason): this
// is only the report of the moment, shown once like every other change.
import type { Change } from './overviewDiff';
import type { LedgerEntry } from './ledgerEntry';

export function ledgerChanges(entries: LedgerEntry[], changes: Change[]): Change[] {
  const out: Change[] = [];
  for (const c of changes) {
    const url = c.what === 'replaced' ? c.url : c.what === 'gone' ? c.was : undefined;
    if (c.kind !== 'file' || !url) continue;
    const hit = entries.filter((e) => e.sourceUrl === url);
    if (!hit.length) continue;
    const verb = c.what === 'gone' ? 'is gone from IS' : 'was replaced';
    out.push({
      kind: 'ledger',
      code: c.code,
      text: `Recheck ${hit.length} ledger ${hit.length === 1 ? 'entry' : 'entries'} in ${c.code}: their source file ${verb} (${hit
        .slice(0, 5)
        .map((e) => `${e.id} ${e.title}`)
        .join('; ')}${hit.length > 5 ? `; and ${hit.length - 5} more` : ''})`,
    });
  }
  return out;
}
