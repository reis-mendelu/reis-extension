/**
 * The pure half of `scripts/android-signin.mjs`: reading a `uiautomator dump`
 * of the IS login, and deciding what may be typed into it and where.
 *
 * Kept apart from the script so it can be tested without a device, and so the
 * script stays about talking to adb.
 */

const APP_PACKAGE = 'cz.reis.app';

/** Every `<node>` in a uiautomator dump, as a plain attribute map. */
function nodes(xml) {
  return [...xml.matchAll(/<node\s([^>]*?)\/?>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
  );
}

function centre(bounds) {
  const [x1, y1, x2, y2] = bounds.match(/\d+/g).map(Number);
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

/**
 * Where to tap for the username field, the password field and the submit
 * button, or null when the IS login is not what is on screen.
 *
 * By IS's own HTML ids first (`credential_0`, `credential_1`, `login-btn`,
 * which the WebView exposes as resource ids), and by field kind when those are
 * renamed. Only nodes of the reIS app count: a password must never be typed
 * into whatever else happens to be drawn over the login.
 */
export function findLoginTargets(xml) {
  const app = nodes(xml).filter((n) => n.package === APP_PACKAGE && n.bounds);
  const fields = app.filter((n) => n.class === 'android.widget.EditText');

  const user =
    fields.find((n) => n['resource-id'] === 'credential_0') ??
    fields.find((n) => n.password !== 'true');
  const pass =
    fields.find((n) => n['resource-id'] === 'credential_1') ??
    fields.find((n) => n.password === 'true');
  const submit =
    app.find((n) => n['resource-id'] === 'login-btn') ??
    app.find((n) => n.class === 'android.widget.Button' && /přihlásit|log ?in/i.test(n.text ?? ''));

  // Both fields, and the password one really flagged as such: without that
  // check a renamed page could put the password into a visible text field.
  if (!user || !pass || !submit || pass.password !== 'true') return null;
  return { user: centre(user.bounds), pass: centre(pass.bounds), submit: centre(submit.bounds) };
}

/** The app's own tab bar is up and the login form is not. */
export function isSignedIn(xml) {
  if (findLoginTargets(xml)) return false;
  return nodes(xml).some((n) => n.package === APP_PACKAGE && n.text === 'Kalendář');
}

/**
 * The value as `adb shell input text` has to receive it.
 *
 * It travels over stdin, not argv, so shell metacharacters need no escaping.
 * What `input text` itself cannot carry is refused rather than mangled: it
 * types `%s` as a space and has no key for non-ASCII characters, and either
 * would submit a wrong password that looks like a typo.
 */
export function encodeInputText(value) {
  if (!value) throw new Error('Refusing to type an empty value.');
  if (value.includes('%s'))
    throw new Error('The value contains "%s", which `input text` types as a space.');
  if (!/^[\x20-\x7e]+$/.test(value)) {
    throw new Error(
      'The value has characters outside printable ASCII, which `input text` cannot type.'
    );
  }
  return value.replaceAll(' ', '%s');
}

/** The serial to drive, from `adb devices` output and an optional request. */
export function pickDevice(adbDevicesOutput, requested) {
  const ready = adbDevicesOutput
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);

  if (requested) {
    if (!ready.includes(requested)) {
      throw new Error(
        `Device ${requested} is not attached (or not authorised). Attached: ${ready.join(', ') || 'none'}`
      );
    }
    return requested;
  }
  if (ready.length === 0)
    throw new Error('No Android device attached. Plug one in and accept the USB-debugging prompt.');
  if (ready.length > 1) {
    throw new Error(
      `Several devices attached: ${ready.join(', ')}. Pick one with --device <serial>.`
    );
  }
  return ready[0];
}
