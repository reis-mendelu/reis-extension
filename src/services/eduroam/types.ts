export interface EduroamProfileInput {
  /** MENDELU root CA, DER-encoded. Also serves as the server-validation anchor. */
  rootCaDer: Uint8Array;
  /** The student's personal certificate + private key, PKCS#12 (.p12) bytes. */
  clientP12: Uint8Array;
  /**
   * PKCS#12 extraction password. When provided it is embedded so macOS installs
   * the identity without prompting (one-tap). When omitted (recommended), the
   * key is absent and macOS prompts for it at install — the downloaded profile
   * is then not a standalone credential. The profile is unsigned, so an embedded
   * password is obfuscated, not encrypted.
   */
  p12Password?: string;
  /** Server names the device validates the RADIUS cert against. Default ["aleph.mendelu.cz"]. */
  serverNames?: string[];
  /** Profile display name. Default "MENDELU eduroam (reIS)". */
  displayName?: string;
  /** Top-level PayloadIdentifier prefix. Default "cz.reis.eduroam". */
  identifier?: string;
  /** Inject UUIDs for deterministic output (tests). Defaults to crypto.randomUUID(). */
  uuids?: { top: string; ca: string; p12: string; wifi: string };
}
