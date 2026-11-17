import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import config from '../../vite.mcp.config';

// The .mcpb bundle inlines officeparser, and Vite turns every optional peer
// it cannot resolve into a module that throws when the bundle loads, so the
// server dies before it answers. officeparser 8.4 added @pdf-lib/fontkit and
// a Dependabot bump shipped exactly that. Each optional peer has to be
// aliased to mcp/optionalPeerStub.ts.
const officeparser = JSON.parse(
  readFileSync(resolve(__dirname, '../../node_modules/officeparser/package.json'), 'utf8')
) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> };

const optionalPeers = Object.entries(officeparser.peerDependenciesMeta ?? {})
  .filter(([, meta]) => meta.optional)
  .map(([name]) => name);

describe('reIS for Claude bundle: officeparser optional peers', () => {
  it('finds the optional peers to check', () => {
    expect(optionalPeers.length).toBeGreaterThan(0);
  });

  it.each(optionalPeers)('stubs %s', (name) => {
    const alias = (config.resolve?.alias ?? {}) as Record<string, string>;
    expect(alias[name]).toBe(resolve(__dirname, '../optionalPeerStub.ts'));
  });
});
