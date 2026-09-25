import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tapping an event reminder opens that event — on the PHONE/iPad only.
 *
 * Event reminders are Capacitor LocalNotifications. The extension posts none:
 * `capacitorReminderDeps().isSupported` is false on every other host, so there
 * is no notification to tap and no tap to handle, and the desktop tree needs no
 * twin of `src/mobile/reminderTap.ts`.
 *
 * Both halves are pinned. The Capacitor boot registers the listener; nothing
 * the extension bundles may reach for it, because the plugin import would ride
 * into the content script the way sonner did in PR #266.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function filesUnder(dir: string): string[] {
  const abs = resolve(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(resolve(abs, name)).isDirectory())
      return name === '__tests__' ? [] : filesUnder(rel);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [rel] : [];
  });
}

describe('reminder tap placement', () => {
  it('reminders are scheduled on Capacitor only', () => {
    expect(read('src/services/eventReminders/sync.ts')).toContain(
      "isSupported: () => getPlatform().kind === 'capacitor'"
    );
  });

  it('the Capacitor boot registers the tap handler', () => {
    expect(read('capacitor/startApp.ts')).toContain('installReminderTapHandler()');
  });

  it('the reminder carries the event id the handler reads', () => {
    expect(read('src/services/eventReminders/sync.ts')).toContain('extra: { eventId: r.eventId }');
    expect(read('src/mobile/reminderTap.ts')).toContain('eventId');
  });

  it('nothing outside the native tree imports the tap handler', () => {
    const importers = [...filesUnder('src'), ...filesUnder('capacitor')].filter((f) =>
      /from ['"][^'"]*reminderTap['"]/.test(read(f))
    );
    expect(importers).toEqual(['capacitor/startApp.ts']);
  });
});
