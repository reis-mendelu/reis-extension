/**
 * What reIS for Claude ships, minus its version: decides whether an app
 * release also releases reIS for Claude (scripts/mcp-publish.mjs).
 *
 * The version sits in both manifests and once in each bundle. It is set to
 * 0.0.0 in the manifests and in a bundle only when it occurs there exactly
 * once; otherwise it stays in, so the next version reads as a change. A release
 * too many is the safe direction, a skipped change is not.
 */
import { createHash } from 'node:crypto';

const PLACEHOLDER = '0.0.0';
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function normalise(path, content, version) {
  if (/(^|\/)(manifest|plugin)\.json$/.test(path)) {
    const json = JSON.parse(content.toString('utf8'));
    return Buffer.from(JSON.stringify({ ...json, version: PLACEHOLDER }));
  }
  if (path.endsWith('.mjs')) {
    const text = content.toString('utf8');
    const quoted = JSON.stringify(version);
    if (text.split(quoted).length === 2) {
      return Buffer.from(text.replace(quoted, JSON.stringify(PLACEHOLDER)));
    }
  }
  return content;
}

/** @param {{path: string, content: Buffer}[]} files  @param {string} version */
export function mcpFingerprint(files, version) {
  const lines = files
    .map(({ path, content }) => `${path}\0${sha256(normalise(path, content, version))}`)
    .sort();
  return sha256(lines.join('\n'));
}

const LINE = /^Fingerprint: ([0-9a-f]{64})$/m;

/** The line the release notes carry, so the next release can compare. */
export const fingerprintLine = (fp) => `Fingerprint: ${fp}`;

/** The fingerprint in a release's notes, or null (releases before 5.9.0 have none). */
export function readFingerprint(notes) {
  return (typeof notes === 'string' && LINE.exec(notes)?.[1]) || null;
}
