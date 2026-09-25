import { readFileSync } from 'node:fs';
import { BEGIN, uncheckedItems } from './checklist';

// Part of the required Release gate: a test → main PR may not merge while the
// published privacy policy lags the repo, or while a generated privacy item is
// unticked. Run by release-gate.yml as `tsx scripts/privacy/gate.ts`, with the
// PR body in $PR_BODY; exits 1 with the reasons.

export const GIST_ID = 'e3007a015e24c210a017d21743f83784';

const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n$/, '');
export const sameContent = (a: string, b: string) => norm(a) === norm(b);

export function gateFindings(i: {
  liveGist: string | null;
  repoPolicy: string;
  prBody: string;
}): string[] {
  const out: string[] = [];
  if (i.liveGist === null) {
    out.push(
      `Could not read the published policy gist ${GIST_ID}; refusing to assume it is current.`
    );
  } else if (!sameContent(i.liveGist, i.repoPolicy)) {
    out.push(
      'The published privacy policy gist differs from docs/privacy-policy-app.md at this commit. Run `npm run privacy:publish`.'
    );
  }
  if (!i.prBody.includes(BEGIN)) {
    out.push('The release PR has no privacy block; re-run the Release checklist workflow.');
  }
  out.push(...uncheckedItems(i.prBody).map((x) => `Unticked privacy item: ${x}`));
  return out;
}

async function main(): Promise<void> {
  let liveGist: string | null = null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {},
    });
    const json = (await res.json()) as { files?: Record<string, { content?: string }> };
    liveGist = json.files?.['privacy.md']?.content ?? null;
  } catch {
    liveGist = null;
  }
  const findings = gateFindings({
    liveGist,
    repoPolicy: readFileSync('docs/privacy-policy-app.md', 'utf-8'),
    prBody: process.env.PR_BODY ?? '',
  });
  for (const f of findings) console.log(`::error::${f}`);
  if (findings.length) process.exit(1);
  console.log('Privacy disclosures: gist current, every item ticked.');
}

if (process.argv[1]?.endsWith('gate.ts')) await main();
