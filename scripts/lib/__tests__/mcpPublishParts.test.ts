import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs helper, no types
import { gitMetadataIn, isOlder, latestVersionOf, releaseNotes } from '../mcpPublishParts.mjs';

describe('isOlder', () => {
  it('compares major, minor and patch numerically', () => {
    expect(isOlder('5.8.0', '5.9.0')).toBe(true);
    expect(isOlder('5.10.0', '5.9.0')).toBe(false);
    expect(isOlder('5.9.0', '5.9.0')).toBe(false);
    expect(isOlder('4.99.99', '5.0.0')).toBe(true);
  });
});

describe('latestVersionOf', () => {
  it('reads the version out of an mcp-v tag and nothing else', () => {
    expect(latestVersionOf('mcp-v0.2.0')).toBe('0.2.0');
    expect(latestVersionOf('v5.9.0')).toBeUndefined();
    expect(latestVersionOf(undefined)).toBeUndefined();
  });
});

describe('gitMetadataIn', () => {
  it('finds Git metadata anywhere in a path, and keeps .claude-plugin', () => {
    const files = [
      'dist-plugin/reis/.claude-plugin/plugin.json',
      'dist-plugin/reis/server/index.mjs',
      'dist-plugin/reis/.git/config',
      'dist-plugin/reis/skills/.gitmodules',
    ];
    expect(gitMetadataIn(files, 'dist-plugin/reis')).toEqual([
      'dist-plugin/reis/.git/config',
      'dist-plugin/reis/skills/.gitmodules',
    ]);
  });
});

describe('releaseNotes', () => {
  it('names the version, the commit and carries the fingerprint line', () => {
    const notes = releaseNotes({
      version: '0.2.0',
      from: 'repo@abc1234',
      fingerprintLine: 'fp: x',
    });
    expect(notes).toContain('reIS for Claude 0.2.0');
    expect(notes).toContain('Built from repo@abc1234.');
    expect(notes.endsWith('fp: x')).toBe(true);
  });
});
