import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phones are portrait-only; the iPad rotates.
 *
 * The phone tree is laid out for a tall screen and `#root` clips instead of
 * scrolling. A Pixel turned sideways is 923×411: the week grid squeezed a whole
 * day into ~130px, so every lesson block was 20px tall and unreadable, and the
 * floating view switch landed on the agenda (Dominik, 2026-10-03, "the calendar
 * doesn't work horizontally"). Locking phones to portrait is what most student
 * and banking apps do; making every screen reflow for 411px was declined.
 *
 * The iPad keeps all four orientations — it has the height. On Android the
 * manifest lock covers tablets too, but apps targeting SDK 36 have orientation
 * restrictions ignored on large screens (≥600dp) by Android 16 itself.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

function plistArray(plist: string, key: string): string[] {
  const block = plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`))?.[1];
  expect(block, `${key} is missing from Info.plist`).toBeDefined();
  return [...(block ?? '').matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1] as string);
}

describe('phones are portrait-only, the iPad rotates', () => {
  const plist = read('ios/App/App/Info.plist');

  it('iPhone supports portrait only', () => {
    expect(plistArray(plist, 'UISupportedInterfaceOrientations')).toEqual([
      'UIInterfaceOrientationPortrait',
    ]);
  });

  it('iPad keeps every orientation', () => {
    expect(plistArray(plist, 'UISupportedInterfaceOrientations~ipad')).toHaveLength(4);
  });

  it('the Android activity is locked to portrait', () => {
    const activity = read('android/app/src/main/AndroidManifest.xml').match(
      /<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>/
    )?.[0];
    expect(activity).toContain('android:screenOrientation="portrait"');
  });
});
