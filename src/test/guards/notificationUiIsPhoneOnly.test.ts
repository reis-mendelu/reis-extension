import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The soft-ask notification card is phone/iPad only — design doc §3 says so
 * outright ("Soft-ask card (phone/iPad tree only)"), and its parity table
 * gives the reason: the extension posts no notifications at all
 * (`syncReminders` only ever runs where a Capacitor host exists), so there is
 * nothing on desktop for the card to ask permission FOR.
 *
 * `components/mobile/NotifySoftAsk.tsx` lives under `components/mobile/`
 * already, so the tree-parity Stop hook never needs telling about IT. What it
 * would flag, without this file, is `components/mobile/sheets/NotificationsSheet.tsx`
 * — a phone-only sheet this task touched to render the card at the top of its
 * scroll area, and the one file in that turn with no desktop-tree counterpart
 * to answer it. Naming it here is CLAUDE.md's decided-divergence escape hatch,
 * not an oversight.
 *
 * Later work (Profile → Spolky's Oznámení toggles and the per-society mute
 * bell — also phone/iPad only, same reason) extends this file rather than
 * adding a second one.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('notification UI is phone/iPad only', () => {
  it('the shared events list only renders the soft-ask card on the phone tree', () => {
    expect(read('components/CampusMap/MapEventsSection.tsx')).toMatch(
      /isPhone\s*&&\s*<NotifySoftAsk/
    );
  });

  // components/mobile/sheets/NotificationsSheet.tsx renders it unconditionally
  // rather than behind an isPhone check — the sheet itself is phone/iPad only,
  // so there is no desktop instance of it to gate.
  it('components/mobile/sheets/NotificationsSheet.tsx renders it at the top of its scroll area', () => {
    const sheet = read('components/mobile/sheets/NotificationsSheet.tsx');
    expect(sheet).toContain('<NotifySoftAsk');
  });

  // The Oznámení group and the per-society mute bells are the shared
  // `SpolkySection`'s optional `notifications` prop (design doc §3's parity
  // table: "no" for the extension, because it posts no notifications at all).
  // Only the phone tab may turn it on; the desktop popup must render exactly
  // as it did before this prop existed.
  it('only ProfileScreen passes `notifications` to SpolkySection', () => {
    const profileScreen = read('components/mobile/screens/ProfileScreen.tsx');
    expect(profileScreen).toMatch(/<SpolkySection[\s\S]*?\bnotifications\b/);
  });

  it('ProfilePopup (desktop) does not pass `notifications` to SpolkySection', () => {
    const profilePopup = read('components/Sidebar/ProfilePopup.tsx');
    const match = profilePopup.match(/<SpolkySection[\s\S]*?\/>/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/\bnotifications\b/);
  });
});
