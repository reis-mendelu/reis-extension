import { describe, it, expect } from 'vitest';
import { getBrowserInfo } from '../browserInfo';

describe('getBrowserInfo: the reIS app itself', () => {
  // Proven against production: every suggestion filed from the iPad landed as
  // browser_name "Unknown", browser_version "0" — rows 8 and 9 in
  // `suggestions`, 2026-09-03. An iOS WKWebView carries no `Version/` token
  // (only Safari proper does) and no `Chrome/`, so it fell through everything.
  //
  // Not cosmetic: `submit_suggestion` rate-limits on
  // `browser_name|browser_version`, so ONE bucket held the entire iOS user
  // base — 100 suggestions an hour between all of them, after which everyone
  // on iOS gets "Nepodařilo se odeslat zpětnou vazbu" and no way to tell it
  // from a real failure.
  it('reads the OS version out of an iOS WKWebView', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(getBrowserInfo(ua)).toEqual({ name: 'iOS', version: '18' });
  });

  it('reads it from an iPhone too', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(getBrowserInfo(ua)).toEqual({ name: 'iOS', version: '17' });
  });

  // Mobile Safari carries BOTH `Version/` and `Safari`, and is a browser
  // visiting IS rather than the app. It must keep reporting as Safari.
  it('still calls mobile Safari Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    expect(getBrowserInfo(ua)).toEqual({ name: 'Safari', version: '17' });
  });

  // Android's WebView already reported Chrome/<n> and always worked; `wv` is
  // what separates the app from Chrome on the same device, worth keeping apart
  // for the same rate-bucket reason.
  it('separates the Android WebView from Chrome', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 wv';
    expect(getBrowserInfo(ua)).toEqual({ name: 'AndroidWebView', version: '126' });
  });

  it('leaves desktop Chrome and Edge alone', () => {
    expect(
      getBrowserInfo(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      )
    ).toEqual({ name: 'Chrome', version: '124' });
    expect(getBrowserInfo('Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36 Edg/124')).toEqual({
      name: 'Edge',
      version: '124',
    });
  });

  it('says Unknown for an empty user agent', () => {
    expect(getBrowserInfo('')).toEqual({ name: 'Unknown', version: '0' });
  });
});

describe('getBrowserInfo: other browsers on iOS', () => {
  // Both are WebKit underneath and carry neither `Version/` nor `Chrome/`, so
  // they reached the generic `CPU OS` branch and were labelled `iOS` — sharing
  // the reIS app's own `submit_suggestion` rate-limit bucket with two browsers
  // that are not the app.
  it('gives Chrome on iOS its own bucket', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
    expect(getBrowserInfo(ua)).toEqual({ name: 'ChromeiOS', version: '126' });
  });

  it('gives Firefox on iOS its own bucket', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';
    expect(getBrowserInfo(ua)).toEqual({ name: 'FirefoxiOS', version: '127' });
  });

  // ...and the app itself is still the app, not lumped in with them.
  it('still calls the reIS WebView iOS', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(getBrowserInfo(ua)).toEqual({ name: 'iOS', version: '18' });
  });
});
