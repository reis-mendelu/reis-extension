import type { Flow } from '../../privacy/disclosures';

// The "What we do send" table in docs/privacy-policy-app.md is generated from
// privacy/disclosures.ts, so the published policy cannot describe a flow the
// source does not have. `npm run privacy:generate` rewrites it; privacy:check
// fails while it is stale.

export const BEGIN = '<!-- BEGIN generated:flows (npm run privacy:generate) -->';
export const END = '<!-- END generated:flows -->';

export function renderPolicyTable(flows: Flow[]): string {
  const rows = flows.flatMap((f) => f.policyRows);
  return [
    '| what | when | what it carries |',
    '|---|---|---|',
    ...rows.map(([what, when, carries]) => `| ${what} | ${when} | ${carries} |`),
  ].join('\n');
}

/** The generated block's current body, or null when a marker is missing. */
export function readGenerated(md: string): string | null {
  const b = md.indexOf(BEGIN);
  const e = md.indexOf(END);
  if (b === -1 || e === -1 || e < b) return null;
  return md.slice(b + BEGIN.length, e).trim();
}

export function replaceGenerated(md: string, table: string): string {
  if (readGenerated(md) === null) {
    throw new Error(`docs/privacy-policy-app.md has no ${BEGIN} … ${END} markers`);
  }
  const b = md.indexOf(BEGIN) + BEGIN.length;
  const e = md.indexOf(END);
  return `${md.slice(0, b)}\n${table}\n${md.slice(e)}`;
}
