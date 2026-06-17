import { bytesToBase64 } from './base64';

const DEFAULT_SERVER_NAMES = ['aleph.mendelu.cz'];
const DEFAULT_IDENTIFIER = 'cz.reis.eduroam';

export interface EapConfigInput {
  /** MENDELU root CA, DER bytes (server-validation anchor). */
  rootCaDer: Uint8Array;
  /** Student's PKCS#12 (cert + private key) bytes. */
  clientP12: Uint8Array;
  /** RADIUS server names to validate. Default ["aleph.mendelu.cz"]. */
  serverNames?: string[];
  /** EAPIdentityProvider ID. Default "cz.reis.eduroam". */
  identifier?: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build an eduroam CAT `.eap-config` (EAP metadata XML) that geteduroam consumes:
 * MENDELU root CA + the student's PKCS#12 client identity + an EAP-TLS profile for
 * the `eduroam` SSID. The .p12 passphrase is intentionally NEVER embedded —
 * geteduroam prompts the student at import, so an intercepted file is an
 * unopenable PKCS#12.
 */
export function generateEapConfig(input: EapConfigInput): string {
  const { rootCaDer, clientP12 } = input;
  if (!rootCaDer || rootCaDer.length === 0) throw new Error('rootCaDer is empty');
  if (!clientP12 || clientP12.length === 0) throw new Error('clientP12 is empty');

  const serverNames = input.serverNames ?? DEFAULT_SERVER_NAMES;
  if (serverNames.length === 0) throw new Error('serverNames is empty');
  const identifier = input.identifier ?? DEFAULT_IDENTIFIER;

  const serverIds = serverNames.map((n) => `          <ServerID>${escapeXml(n)}</ServerID>`).join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<EAPIdentityProviderList xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="eap-metadata.xsd">',
    `  <EAPIdentityProvider ID="${escapeXml(identifier)}" namespace="urn:RFC4282:realm">`,
    '    <AuthenticationMethods>',
    '      <AuthenticationMethod>',
    '        <EAPMethod>',
    '          <Type>13</Type>',
    '        </EAPMethod>',
    '        <ServerSideCredential>',
    `          <CA format="X.509" encoding="base64">${bytesToBase64(rootCaDer)}</CA>`,
    serverIds,
    '        </ServerSideCredential>',
    '        <ClientSideCredential>',
    `          <ClientCertificate format="PKCS12" encoding="base64">${bytesToBase64(clientP12)}</ClientCertificate>`,
    '        </ClientSideCredential>',
    '      </AuthenticationMethod>',
    '    </AuthenticationMethods>',
    '    <CredentialApplicability>',
    '      <IEEE80211>',
    '        <SSID>eduroam</SSID>',
    '        <MinRSNProto>CCMP</MinRSNProto>',
    '      </IEEE80211>',
    '    </CredentialApplicability>',
    '  </EAPIdentityProvider>',
    '</EAPIdentityProviderList>',
    '',
  ].join('\n');
}
