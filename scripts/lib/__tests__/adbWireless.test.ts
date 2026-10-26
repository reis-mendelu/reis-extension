import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { isWifiSerial, parseMdnsConnect, parsePairArgs } from '../adbWireless.mjs';

// android-push used to need the cable once per phone reboot (`adb tcpip`).
// Android 11+ Wireless debugging needs none: pair once, and the phone
// advertises itself over mDNS whenever the toggle is on.
describe('isWifiSerial', () => {
  it('treats ip:port and mDNS transports as Wi-Fi, a bare serial as USB', () => {
    expect(isWifiSerial('192.168.1.23:5555')).toBe(true);
    // How adb names a phone it auto-connected over mDNS — no colon in it, so
    // the old `includes(':')` test took it for a cable.
    expect(isWifiSerial('adb-64011JEBF02460-Ab12Cd._adb-tls-connect._tcp')).toBe(true);
    expect(isWifiSerial('64011JEBF02460')).toBe(false);
  });
});

describe('parseMdnsConnect', () => {
  it('returns the connect endpoints, not the pairing ones', () => {
    const out = [
      'List of discovered mdns services',
      'adb-64011JEBF02460-Ab12Cd\t_adb-tls-connect._tcp\t192.168.1.23:37199',
      'adb-64011JEBF02460-Ab12Cd\t_adb-tls-pairing._tcp\t192.168.1.23:41011',
    ].join('\n');
    expect(parseMdnsConnect(out)).toEqual(['192.168.1.23:37199']);
  });

  it('reads the older space-separated form with a trailing dot', () => {
    const out =
      'List of discovered mdns services\nadb-X-y    _adb-tls-connect._tcp.    10.0.1.40:40123\n';
    expect(parseMdnsConnect(out)).toEqual(['10.0.1.40:40123']);
  });

  it('is empty when nothing advertises', () => {
    expect(parseMdnsConnect('List of discovered mdns services\n')).toEqual([]);
  });
});

describe('parsePairArgs', () => {
  it('is null without --pair', () => {
    expect(parsePairArgs(['node', 'android-push.mjs'])).toBeNull();
  });

  it('reads the address and the six-digit code the phone shows', () => {
    expect(parsePairArgs(['node', 'x', '--pair', '192.168.1.23:41011', '482913'])).toEqual({
      address: '192.168.1.23:41011',
      code: '482913',
    });
  });

  it('throws on a malformed address or code rather than pairing with nothing', () => {
    expect(() => parsePairArgs(['node', 'x', '--pair', '192.168.1.23', '482913'])).toThrow();
    expect(() => parsePairArgs(['node', 'x', '--pair', '192.168.1.23:41011'])).toThrow();
    expect(() => parsePairArgs(['node', 'x', '--pair', '192.168.1.23:41011', '48291'])).toThrow();
  });
});
