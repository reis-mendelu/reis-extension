import type { AppleType, Flow } from '../../privacy/disclosures';

// What changed, per store, between the disclosures at the last release tag and
// the release head. Drives the release PR's generated privacy checklist.

export interface Change {
  added: string[];
  removed: string[];
}

export interface StoreDiff {
  /** False when the last tag has no privacy/disclosures.ts: audit everything once. */
  baseline: boolean;
  apple: Change;
  play: Change;
  cws: Change;
  firefox: Change;
  policyChanged: boolean;
  /** Answers in privacy/play-data-safety.csv changed even if the data types did not. Set by the CLI. */
  playCsvChanged: boolean;
}

export const appleLabel = (a: AppleType) =>
  `${a.type} — ${a.purpose}, ${a.linked ? 'linked' : 'not linked'}, not tracking`;

const uniq = (xs: string[]) => [...new Set(xs)].sort();

function change(before: string[], after: string[]): Change {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: uniq(after.filter((x) => !b.has(x))),
    removed: uniq(before.filter((x) => !a.has(x))),
  };
}

const values = (flows: Flow[]) => ({
  apple: uniq(flows.flatMap((f) => f.stores.apple.map(appleLabel))),
  play: uniq(flows.flatMap((f) => f.stores.play)),
  cws: uniq(flows.flatMap((f) => f.stores.cws)),
  firefox: uniq(flows.flatMap((f) => f.stores.firefox)),
  policy: JSON.stringify(flows.flatMap((f) => f.policyRows)),
});

export function diffStores(before: Flow[] | null, after: Flow[]): StoreDiff {
  const a = values(after);
  const b = before ? values(before) : { apple: [], play: [], cws: [], firefox: [], policy: '' };
  return {
    baseline: before !== null,
    apple: change(b.apple, a.apple),
    play: change(b.play, a.play),
    cws: change(b.cws, a.cws),
    firefox: change(b.firefox, a.firefox),
    policyChanged: b.policy !== a.policy,
    playCsvChanged: false,
  };
}
