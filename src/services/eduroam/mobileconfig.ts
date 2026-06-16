import { bytesToBase64 } from './base64';
import { pdict, parr, pstr, pint, pbool, pdata, serializePlist } from './plist';
import type { EduroamProfileInput } from './types';

const DEFAULT_SERVER_NAMES = ['aleph.mendelu.cz'];
const DEFAULT_DISPLAY_NAME = 'MENDELU eduroam (reIS)';
const DEFAULT_IDENTIFIER = 'cz.reis.eduroam';

// crypto.randomUUID() already returns a canonical lowercase RFC 4122 UUID.
const newUuid = (): string => crypto.randomUUID();

/**
 * Build a macOS .mobileconfig that installs the MENDELU root CA, the client
 * PKCS#12 identity, and an EAP-TLS eduroam Wi-Fi payload referencing both.
 * The .p12 password is intentionally never embedded — macOS prompts at install.
 */
export function generateEduroamMobileconfig(input: EduroamProfileInput): string {
  const { rootCaDer, clientP12 } = input;
  if (!rootCaDer || rootCaDer.length === 0) throw new Error('rootCaDer is empty');
  if (!clientP12 || clientP12.length === 0) throw new Error('clientP12 is empty');

  const serverNames = input.serverNames ?? DEFAULT_SERVER_NAMES;
  if (serverNames.length === 0) throw new Error('serverNames is empty');

  const displayName = input.displayName ?? DEFAULT_DISPLAY_NAME;
  const identifier = input.identifier ?? DEFAULT_IDENTIFIER;
  const ids = input.uuids ?? { top: newUuid(), ca: newUuid(), p12: newUuid(), wifi: newUuid() };

  const caPayload = pdict([
    ['PayloadType', pstr('com.apple.security.root')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.ca`)],
    ['PayloadUUID', pstr(ids.ca)],
    ['PayloadDisplayName', pstr('MENDELU Root CA')],
    ['PayloadContent', pdata(bytesToBase64(rootCaDer))],
  ]);

  const p12Entries: Array<[string, ReturnType<typeof pstr>]> = [
    ['PayloadType', pstr('com.apple.security.pkcs12')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.identity`)],
    ['PayloadUUID', pstr(ids.p12)],
    ['PayloadDisplayName', pstr('eduroam user certificate')],
    ['PayloadContent', pdata(bytesToBase64(clientP12))],
  ];
  // Embed the password only when explicitly provided; otherwise omit it so the
  // OS prompts at install and the downloaded profile is not a standalone credential.
  if (input.p12Password) p12Entries.push(['Password', pstr(input.p12Password)]);
  const p12Payload = pdict(p12Entries);

  const wifiPayload = pdict([
    ['PayloadType', pstr('com.apple.wifi.managed')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(`${identifier}.wifi`)],
    ['PayloadUUID', pstr(ids.wifi)],
    ['PayloadDisplayName', pstr('eduroam')],
    ['SSID_STR', pstr('eduroam')],
    ['AutoJoin', pbool(true)],
    ['EncryptionType', pstr('WPA')],
    [
      'EAPClientConfiguration',
      pdict([
        ['AcceptEAPTypes', parr([pint(13)])], // 13 = EAP-TLS
        ['PayloadCertificateAnchorUUID', parr([pstr(ids.ca)])],
        ['TLSTrustedServerNames', parr(serverNames.map((n) => pstr(n)))],
        ['TLSAllowTrustExceptions', pbool(false)],
      ]),
    ],
    ['PayloadCertificateUUID', pstr(ids.p12)], // selects the client identity
  ]);

  const top = pdict([
    ['PayloadType', pstr('Configuration')],
    ['PayloadVersion', pint(1)],
    ['PayloadIdentifier', pstr(identifier)],
    ['PayloadUUID', pstr(ids.top)],
    ['PayloadDisplayName', pstr(displayName)],
    ['PayloadOrganization', pstr('reIS')],
    ['PayloadContent', parr([caPayload, p12Payload, wifiPayload])],
  ]);

  return serializePlist(top);
}
