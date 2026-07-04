import { bytesToBase64 } from './base64';
import { formatValidUntil } from './certExpiry';

const DEFAULT_SERVER_NAMES = ['aleph.mendelu.cz'];
const DEFAULT_IDENTIFIER = 'cz.reis.eduroam';
const DEFAULT_DISPLAY_NAME = 'MENDELU eduroam (reIS)';

export interface EapConfigInput {
  /** MENDELU root CA, DER bytes (server-validation anchor). */
  rootCaDer: Uint8Array;
  /** Student's PKCS#12 (cert + private key) bytes. */
  clientP12: Uint8Array;
  /** RADIUS server names to validate. Default ["aleph.mendelu.cz"]. */
  serverNames?: string[];
  /** EAPIdentityProvider ID. Default "cz.reis.eduroam". */
  identifier?: string;
  /** Institution name geteduroam shows at import. Default "MENDELU eduroam (reIS)". */
  displayName?: string;
  /**
   * Client-certificate expiry. When provided, emitted as `<ValidUntil>` so
   * geteduroam knows the real expiry and reminds the student to renew ~5 days
   * before it — instead of the network dying silently at ~day 366.
   */
  validUntil?: Date;
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
  const displayName = input.displayName ?? DEFAULT_DISPLAY_NAME;

  const serverIds = serverNames.map((n) => `          <ServerID>${escapeXml(n)}</ServerID>`).join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<EAPIdentityProviderList xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="eap-metadata.xsd">',
    `  <EAPIdentityProvider ID="${escapeXml(identifier)}" namespace="urn:RFC4282:realm" version="1">`,
    // ValidUntil is first in the eap-metadata.xsd sequence (before
    // AuthenticationMethods). geteduroam parses it with SERVER_DATE_FORMAT.
    ...(input.validUntil ? [`    <ValidUntil>${formatValidUntil(input.validUntil)}</ValidUntil>`] : []),
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
    // ProviderInfo is optional in eap-metadata.xsd but REQUIRED by geteduroam's
    // Android parser model; geteduroam also shows DisplayName at import time.
    '    <ProviderInfo>',
    `      <DisplayName>${escapeXml(displayName)}</DisplayName>`,
    '    </ProviderInfo>',
    '  </EAPIdentityProvider>',
    '</EAPIdentityProviderList>',
    '',
  ].join('\n');
}
