import { describe, it, expect } from 'vitest';
import { identifyTileRequest, OSM_TILE_IDENTITY } from '../osmTileIdentity';

const EXT = 'moz-extension://11111111-2222-3333-4444-555555555555/';
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0';

const ua = (headers: chrome.webRequest.HttpHeader[] | undefined) =>
  headers?.find((h) => h.name.toLowerCase() === 'user-agent')?.value;

describe('identifyTileRequest', () => {
  it("appends reIS's identity, one space apart, to a tile reIS's own page loads", () => {
    const out = identifyTileRequest(
      {
        requestHeaders: [{ name: 'User-Agent', value: FIREFOX_UA }],
        documentUrl: `${EXT}main.html`,
        originUrl: `${EXT}main.html`,
      },
      EXT
    );
    expect(ua(out)).toBe(`${FIREFOX_UA} ${OSM_TILE_IDENTITY}`);
  });

  it('keeps every other header as it was', () => {
    const out = identifyTileRequest(
      {
        requestHeaders: [
          { name: 'Accept', value: 'image/avif' },
          { name: 'User-Agent', value: FIREFOX_UA },
        ],
        documentUrl: `${EXT}main.html`,
      },
      EXT
    );
    expect(out?.[0]).toEqual({ name: 'Accept', value: 'image/avif' });
  });

  it('leaves a tile some other site loads alone', () => {
    const out = identifyTileRequest(
      {
        requestHeaders: [{ name: 'User-Agent', value: FIREFOX_UA }],
        documentUrl: 'https://www.mapy.cz/',
        originUrl: 'https://www.mapy.cz/',
      },
      EXT
    );
    expect(out).toBeUndefined();
  });

  it("leaves another extension's tiles alone", () => {
    const out = identifyTileRequest(
      {
        requestHeaders: [{ name: 'User-Agent', value: FIREFOX_UA }],
        documentUrl: 'moz-extension://99999999-0000-0000-0000-000000000000/page.html',
      },
      EXT
    );
    expect(out).toBeUndefined();
  });

  it('does not append twice', () => {
    const out = identifyTileRequest(
      {
        requestHeaders: [{ name: 'user-agent', value: `${FIREFOX_UA} ${OSM_TILE_IDENTITY}` }],
        documentUrl: `${EXT}main.html`,
      },
      EXT
    );
    expect(out).toBeUndefined();
  });

  it('does nothing when the request has no initiator to check', () => {
    const out = identifyTileRequest(
      { requestHeaders: [{ name: 'User-Agent', value: FIREFOX_UA }] },
      EXT
    );
    expect(out).toBeUndefined();
  });
});
