import { describe, it, expect } from 'vitest';
import { pdict, parr, pstr, pint, pbool, pdata, serializePlist } from './plist';

describe('serializePlist', () => {
  it('escapes & and < in string values', () => {
    const xml = serializePlist(pdict([['k', pstr('a & b < c')]]));
    expect(xml).toContain('<key>k</key>');
    expect(xml).toContain('<string>a &amp; b &lt; c</string>');
  });

  it('renders integer, bool, data and array nodes', () => {
    const xml = serializePlist(
      pdict([
        ['n', pint(13)],
        ['b', pbool(false)],
        ['d', pdata('TWFu')],
        ['a', parr([pstr('x'), pstr('y')])],
      ]),
    );
    expect(xml).toContain('<integer>13</integer>');
    expect(xml).toContain('<false/>');
    expect(xml).toContain('<data>TWFu</data>');
    expect(xml).toContain('<array>');
    expect(xml).toMatch(/<string>x<\/string>[\s\S]*<string>y<\/string>/);
  });

  it('wraps output in the plist XML + DOCTYPE header', () => {
    const xml = serializePlist(pdict([]));
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"');
    expect(xml).toContain('<plist version="1.0">');
  });
});
