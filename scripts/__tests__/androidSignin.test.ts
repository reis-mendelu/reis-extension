import { describe, it, expect } from 'vitest';
import {
  encodeInputText,
  findLoginTargets,
  isSignedIn,
  pickDevice,
} from '../lib/androidSignin.mjs';

/** Trimmed from a real `uiautomator dump` of the IS login in the app's WebView. */
const LOGIN_DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="Přihlášení do UIS" resource-id="cz.reis.app:id/titleText" class="android.widget.TextView" package="cz.reis.app" password="false" bounds="[401,173][679,224]" />
<node index="1" text="" resource-id="credential_0" class="android.widget.EditText" package="cz.reis.app" password="false" bounds="[401,665][680,703]" />
<node index="2" text="" resource-id="credential_1" class="android.widget.EditText" package="cz.reis.app" password="true" bounds="[401,734][680,773]" />
<node index="3" text="Přihlásit se" resource-id="login-btn" class="android.widget.Button" package="cz.reis.app" password="false" bounds="[401,783][680,830]" />
</hierarchy>`;

const APP_DUMP = `<hierarchy><node text="Kalendář" resource-id="" class="android.view.View" package="cz.reis.app" password="false" bounds="[175,2094][294,2212]" /></hierarchy>`;

describe('findLoginTargets', () => {
  it('finds the username, password and button by their IS ids, as tap centres', () => {
    expect(findLoginTargets(LOGIN_DUMP)).toEqual({
      user: { x: 541, y: 684 },
      pass: { x: 541, y: 754 },
      submit: { x: 541, y: 807 },
    });
  });

  it('falls back to field kind when IS renames its ids', () => {
    const renamed = LOGIN_DUMP.replace('credential_0', 'u')
      .replace('credential_1', 'p')
      .replace('login-btn', 'b');
    expect(findLoginTargets(renamed)).toEqual(findLoginTargets(LOGIN_DUMP));
  });

  it('returns null off the login page, so nothing is typed into the app itself', () => {
    expect(findLoginTargets(APP_DUMP)).toBeNull();
  });

  it('ignores another app drawn over the login', () => {
    expect(findLoginTargets(LOGIN_DUMP.replaceAll('cz.reis.app', 'com.other'))).toBeNull();
  });
});

describe('isSignedIn', () => {
  it('is true once the app tabs show and the login is gone', () => {
    expect(isSignedIn(APP_DUMP)).toBe(true);
    expect(isSignedIn(LOGIN_DUMP)).toBe(false);
  });
});

describe('encodeInputText', () => {
  it('encodes spaces the way `input text` expects', () => {
    expect(encodeInputText('a b')).toBe('a%sb');
  });

  it('passes shell metacharacters through untouched (they travel over stdin)', () => {
    expect(encodeInputText(`$x'"\`;&|`)).toBe(`$x'"\`;&|`);
  });

  it('refuses what `input text` would silently mangle', () => {
    expect(() => encodeInputText('heslo%sx')).toThrow(/%s/);
    expect(() => encodeInputText('žluť')).toThrow(/ASCII/);
    expect(() => encodeInputText('')).toThrow(/empty/);
  });
});

describe('pickDevice', () => {
  const two =
    'List of devices attached\n64011JEBF02460\tdevice usb:1 model:Pixel_9a\nemulator-5554\tdevice product:x\n\n';

  it('uses the one attached device', () => {
    expect(pickDevice('List of devices attached\nemulator-5554\tdevice\n', undefined)).toBe(
      'emulator-5554'
    );
  });

  it('refuses to guess between several', () => {
    expect(() => pickDevice(two, undefined)).toThrow(/64011JEBF02460.*emulator-5554/s);
  });

  it('takes the requested one, and only if it is attached and authorised', () => {
    expect(pickDevice(two, 'emulator-5554')).toBe('emulator-5554');
    expect(() => pickDevice(two, 'nope')).toThrow(/not attached/);
    expect(() => pickDevice('List of devices attached\nX\tunauthorized\n', 'X')).toThrow(
      /not attached/
    );
  });

  it('says so when nothing is attached', () => {
    expect(() => pickDevice('List of devices attached\n\n', undefined)).toThrow(
      /No Android device/
    );
  });
});
