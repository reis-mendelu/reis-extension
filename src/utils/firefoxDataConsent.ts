// Firefox's built-in data-collection consent (Firefox 140+), and nothing else.
//
// Firefox makes an extension declare what it transmits in
// `browser_specific_settings.gecko.data_collection_permissions` (wxt.config.ts)
// and then enforces it as consent: `technicalAndInteraction` is a toggle shown
// at install and in about:addons, and every other optional category must be
// granted through `permissions.request` before anything in it is sent.
//
// Detection is by feature, not user agent: only Firefox's `permissions.getAll()`
// returns a `data_collection` key. Everywhere else — Chrome, Edge, the iOS and
// Android apps, the dev webapp — there is no such API, and every check here
// answers "allowed", leaving those products exactly as they were.

export type DataCategory =
  | 'technicalAndInteraction'
  | 'websiteContent'
  | 'personallyIdentifyingInfo'
  | 'personalCommunications';

interface PermissionsApi {
  getAll(): Promise<{ data_collection?: string[] }>;
  request(p: { data_collection: DataCategory[] }): Promise<boolean>;
}

let supported: boolean | null = null;

function permissionsApi(): PermissionsApi | null {
  const b = (globalThis as { browser?: { permissions?: PermissionsApi } }).browser;
  return b?.permissions ?? null;
}

async function grantedNow(): Promise<string[] | null> {
  try {
    const all = await permissionsApi()?.getAll();
    return Array.isArray(all?.data_collection) ? all.data_collection : null;
  } catch {
    return null;
  }
}

/**
 * Learns once, at boot, whether this browser has the consent API. It has to be
 * known ahead of time: `requestDataConsent` runs inside a click, and awaiting a
 * lookup there first would cost Firefox's user-action status.
 */
export async function initDataConsent(): Promise<void> {
  supported = (await grantedNow()) !== null;
}

/** For a background send. Re-read each time: the user can revoke it in about:addons. */
export async function hasDataConsent(category: DataCategory): Promise<boolean> {
  if (supported === null) await initDataConsent();
  if (!supported) return true;
  const granted = await grantedNow();
  return granted?.includes(category) ?? false;
}

/**
 * For a send the student just asked for. MUST be the first thing the click
 * handler calls, before any await: Firefox accepts `permissions.request` only
 * while it is handling user input. Already-granted categories resolve at once,
 * without a prompt.
 */
export function requestDataConsent(categories: DataCategory[]): Promise<boolean> {
  const api = permissionsApi();
  if (!supported || !api || categories.length === 0) return Promise.resolve(true);
  try {
    return api.request({ data_collection: categories }).then(
      (ok) => ok === true,
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}

/** What a report carries, in Firefox's terms. The message itself is always one. */
export function reportConsentCategories(r: {
  contact: string;
  screenshot: boolean;
  diagnostics: boolean;
}): DataCategory[] {
  const out: DataCategory[] = ['personalCommunications'];
  if (r.contact.trim()) out.push('personallyIdentifyingInfo');
  if (r.screenshot) out.push('websiteContent');
  if (r.diagnostics) out.push('technicalAndInteraction');
  return out;
}

export function __resetDataConsentForTests(): void {
  supported = null;
}
