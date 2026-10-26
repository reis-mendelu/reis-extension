/**
 * Android 11+ "Wireless debugging", for android-push: pair once with the code
 * the phone shows, and from then on the phone advertises itself over mDNS
 * whenever the toggle is on — no cable, no IP to type.
 */

/** A transport over the network: `ip:port`, or the name adb gives an mDNS one. */
export function isWifiSerial(serial) {
  return serial.includes(':') || /\._adb-tls-connect\._tcp/.test(serial);
}

/**
 * The `host:port` endpoints of paired phones in `adb mdns services` output.
 * Pairing endpoints (`_adb-tls-pairing`) are left out: connecting to one fails.
 */
export function parseMdnsConnect(output) {
  return output
    .split('\n')
    .map((l) => l.match(/_adb-tls-connect\._tcp\.?\s+(\S+:\d+)\s*$/)?.[1])
    .filter(Boolean);
}

/** `--pair <ip:port> <code>`, as the phone's "Pair device with pairing code" shows them. */
export function parsePairArgs(argv) {
  const i = argv.indexOf('--pair');
  if (i === -1) return null;
  const address = argv[i + 1] ?? '';
  const code = argv[i + 2] ?? '';
  if (!/^\S+:\d+$/.test(address) || !/^\d{6}$/.test(code)) {
    throw new Error(
      'usage: npm run android:push -- --pair <ip:port> <six-digit code>\n' +
        '(Developer options → Wireless debugging → Pair device with pairing code)'
    );
  }
  return { address, code };
}
