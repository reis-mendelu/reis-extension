import type { Change, StoreDiff } from './diff';

// The privacy block of the release PR. Every checkbox is a store action the
// release gate refuses to merge without; Claude does all of them except the
// Chrome Web Store, which Chrome will not let any extension operate.

export const BEGIN = '<!-- BEGIN privacy-disclosures -->';
export const END = '<!-- END privacy-disclosures -->';

const fmt = (c: Change) =>
  [...c.added.map((x) => `+ ${x}`), ...c.removed.map((x) => `− ${x}`)].join('; ');
const changed = (c: Change) => c.added.length + c.removed.length > 0;

export function renderChecklist(d: StoreDiff, sinceTag: string): string {
  const items: string[] = [];
  if (d.policyChanged) {
    items.push(
      '- [ ] Privacy policy gist republished from `docs/privacy-policy-app.md` — `npm run privacy:publish` (Claude). The release gate also compares the live gist.'
    );
  }
  if (changed(d.play) || d.playCsvChanged) {
    const what = changed(d.play) ? fmt(d.play) : 'answers changed in the CSV';
    items.push(
      `- [ ] Play Data safety: ${what} — push \`privacy/play-data-safety.csv\` with \`npm run privacy:publish\`, then Send for review in Publishing overview (Claude)`
    );
  }
  if (changed(d.apple)) {
    items.push(
      `- [ ] App Store privacy label: ${fmt(d.apple)} — App Store Connect → App Privacy, then Publish (Claude, Chrome MCP)`
    );
  }
  if (changed(d.cws)) {
    items.push(
      `- [ ] Chrome Web Store privacy practices: ${fmt(d.cws)} — dashboard → Privacy → Data usage, Save draft, Submit for review (Dominik — Chrome blocks automation of the Web Store)`
    );
  }

  const heading = d.baseline
    ? `### Privacy disclosures — changed since ${sinceTag}`
    : `### Privacy disclosures — first release under privacy/disclosures.ts: verify every store once against it`;
  const body = items.length
    ? items.join('\n')
    : `No store declaration changed since ${sinceTag} — nothing to do.`;
  const firefox = changed(d.firefox)
    ? `\n\nFirefox categories changed (${fmt(d.firefox)}); they ship in the manifest with the next extension build — no store form.`
    : '';
  return `${BEGIN}\n${heading}\n\n${body}${firefox}\n${END}`;
}

/** The text of every unticked item inside the privacy block. */
export function uncheckedItems(prBody: string): string[] {
  const b = prBody.indexOf(BEGIN);
  const e = prBody.indexOf(END);
  if (b === -1 || e === -1) return [];
  return prBody
    .slice(b, e)
    .split(/\r?\n/)
    .map((l) => /^\s*- \[ \]\s+(.*)$/.exec(l)?.[1])
    .filter((x): x is string => Boolean(x))
    .map((x) => x.trim());
}

/**
 * Puts `block` into `body`: replaces an existing privacy block or appends one.
 * An item already ticked keeps its tick when the same item is regenerated, so
 * a refresh after `test` moves never undoes work already done.
 */
export function placeBlock(body: string, block: string): string {
  const b = body.indexOf(BEGIN);
  const e = body.indexOf(END);
  if (b === -1 || e === -1) return body ? `${body}\n\n${block}\n` : `${block}\n`;
  const old = body.slice(b, e + END.length);
  const ticked = new Set(
    old
      .split(/\r?\n/)
      .map((l) => /^\s*- \[[xX]\]\s+(.*)$/.exec(l)?.[1]?.trim())
      .filter((x): x is string => Boolean(x))
  );
  const merged = block
    .split('\n')
    .map((l) => {
      const item = /^- \[ \]\s+(.*)$/.exec(l)?.[1]?.trim();
      return item && ticked.has(item) ? `- [x] ${item}` : l;
    })
    .join('\n');
  return body.slice(0, b) + merged + body.slice(e + END.length);
}
