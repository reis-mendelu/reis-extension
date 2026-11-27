// Small pure parts of scripts/mcp-publish.mjs, kept apart so they are tested and the script
// stays short.
import { relative, sep } from 'node:path';

const parts = (v) => v.split('.').map(Number);

/** True when version `a` is lower than version `b` (both X.Y.Z). */
export function isOlder(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

/** The X.Y.Z of an `mcp-vX.Y.Z` tag, or undefined for any other tag. */
export const latestVersionOf = (tagName) => /^mcp-v(\d+\.\d+\.\d+)$/.exec(tagName ?? '')?.[1];

/**
 * The plugin directory comes from another job's artifact and is copied into a clone that
 * holds the token, so Git metadata in it (a .git/config with a core.fsmonitor command) must
 * never get that far. `.claude-plugin` is the plugin's own folder and stays.
 */
export const gitMetadataIn = (files, root) =>
  files.filter((p) =>
    relative(root, p)
      .split(sep)
      .some((part) => part.startsWith('.git'))
  );

/** The release notes: how a student installs, where it was built from, the fingerprint. */
export const releaseNotes = ({ version, from, fingerprintLine }) =>
  [
    `reIS for Claude ${version} pro Claude Desktop.`,
    '',
    'Stáhni `reis-for-claude.mcpb`, otevři ho dvojklikem a v Claude Desktop klikni na Install. Návod: https://reisapp.cz/navody/reis-v-claude',
    '',
    'Download `reis-for-claude.mcpb`, double-click it and press Install in Claude Desktop. Guide: https://reisapp.cz/navody/reis-v-claude',
    '',
    `Built from ${from}.`,
    '',
    fingerprintLine,
  ].join('\n');
