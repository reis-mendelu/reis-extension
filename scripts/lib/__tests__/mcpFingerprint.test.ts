import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { fingerprintLine, mcpFingerprint, readFingerprint } from '../mcpFingerprint.mjs';

// reIS for Claude is released with every app release, but only when what it
// ships changed. The version is in the output (the manifests and, once, in the
// bundle), so the fingerprint has to leave it out, or every release would look
// like a change and every Desktop student would be told to download again.
const file = (path: string, text: string) => ({ path, content: Buffer.from(text) });
const output = (version: string, code = 'run()') => [
  file('mcpb/manifest.json', JSON.stringify({ name: 'reis-mendelu', version })),
  file('mcpb/server/index.mjs', `const version = "${version}";\n${code}\n`),
  file('plugin/.claude-plugin/plugin.json', JSON.stringify({ name: 'reis', version })),
  file('plugin/server/index.mjs', `const version = "${version}";\n${code}\n`),
];

describe('mcpFingerprint', () => {
  it('is the same for two versions of the same output', () => {
    expect(mcpFingerprint(output('5.9.0'), '5.9.0')).toBe(mcpFingerprint(output('5.8.0'), '5.8.0'));
  });

  it('changes when the code changes', () => {
    expect(mcpFingerprint(output('5.9.0', 'run(2)'), '5.9.0')).not.toBe(
      mcpFingerprint(output('5.8.0'), '5.8.0')
    );
  });

  it('changes when a file is added, removed or renamed', () => {
    const base = mcpFingerprint(output('5.8.0'), '5.8.0');
    const more = [...output('5.8.0'), file('plugin/README.md', 'hi')];
    expect(mcpFingerprint(more, '5.8.0')).not.toBe(base);
    expect(mcpFingerprint(output('5.8.0').slice(1), '5.8.0')).not.toBe(base);
    const renamed = output('5.8.0').map((f, i) => (i === 0 ? { ...f, path: 'mcpb/m.json' } : f));
    expect(mcpFingerprint(renamed, '5.8.0')).not.toBe(base);
  });

  it('does not depend on the order the files are listed in', () => {
    expect(mcpFingerprint([...output('5.8.0')].reverse(), '5.8.0')).toBe(
      mcpFingerprint(output('5.8.0'), '5.8.0')
    );
  });

  it('counts the output as changed when the version is not in a bundle exactly once', () => {
    // A dependency that happens to carry the same string: the version cannot be
    // told apart, so it stays in, and the next version differs. Releasing once
    // too often is the safe direction; skipping a real change is not.
    const twice = (v: string) => output(v, `dep("${v}")`);
    expect(mcpFingerprint(twice('5.9.0'), '5.9.0')).not.toBe(
      mcpFingerprint(twice('5.8.0'), '5.8.0')
    );
  });

  it('notices a manifest change other than the version', () => {
    const renamed = output('5.8.0').map((f, i) =>
      i === 0 ? file(f.path, JSON.stringify({ name: 'other', version: '5.8.0' })) : f
    );
    expect(mcpFingerprint(renamed, '5.8.0')).not.toBe(mcpFingerprint(output('5.8.0'), '5.8.0'));
  });
});

describe('fingerprint line in the release notes', () => {
  it('round-trips', () => {
    const fp = mcpFingerprint(output('5.8.0'), '5.8.0');
    expect(readFingerprint(`Some notes.\n\n${fingerprintLine(fp)}\n`)).toBe(fp);
  });

  it('is null for notes without one (every release before automation)', () => {
    expect(readFingerprint('reIS for Claude 0.1.5 pro Claude Desktop.')).toBeNull();
    expect(readFingerprint(undefined)).toBeNull();
  });
});
