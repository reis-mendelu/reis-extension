import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
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
    // The first child of the scrolling container, ahead of every section.
    expect(sheet).toMatch(/overflow-y-auto[^>]*>\s*<NotifySoftAsk\b/);
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

/**
 * The two checks above name the files this task actually touched. This block
 * is the general form: it walks every production file under the desktop
 * tree's `Sidebar`, `AppMain.tsx` and `AppOverlays.tsx` — the same three roots
 * CLAUDE.md's tree-parity hook watches — so a FUTURE desktop file that reaches
 * for `NotifySoftAsk`, `NotifySettings`/`MuteBell`, or a `notifications` prop
 * on `SpolkySection` fails here too, without anyone remembering to extend the
 * named list. `SpolkySection.tsx` itself is excluded: it is the one file
 * allowed to import `NotifySettings`/`MuteBell`, because it is where the
 * `notifications` prop gates them. `__tests__` directories are excluded —
 * they exercise the component in isolation, not from the desktop tree.
 */
const DESKTOP_ROOTS = [
  'components/Sidebar',
  'components/AppMain.tsx',
  'components/AppOverlays.tsx',
];
const SPOLKY_SECTION_DEFINITION = 'components/Sidebar/Profile/SpolkySection.tsx';

function collectProductionFiles(relPath: string): string[] {
  const abs = resolve(process.cwd(), 'src', relPath);
  if (statSync(abs).isFile()) {
    return /\.tsx?$/.test(relPath) ? [relPath] : [];
  }
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const childRel = join(relPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectProductionFiles(childRel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(childRel);
    }
  }
  return out;
}

describe('no desktop-tree file reaches for the phone-only notification UI', () => {
  const files = DESKTOP_ROOTS.flatMap(collectProductionFiles).filter(
    (f) => f !== SPOLKY_SECTION_DEFINITION
  );

  it('scanned at least the known desktop files', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files).toContain('components/Sidebar/ProfilePopup.tsx');
  });

  // Keyed on the module specifier, not the imported names, so a default,
  // `import type`, `export … from`, dynamic or multi-line import is caught
  // as well as a named one.
  it.each(files)('%s does not import NotifySoftAsk', (file) => {
    expect(read(file)).not.toMatch(/['"][^'"]*\bNotifySoftAsk['"]/);
  });

  it.each(files)('%s does not import NotifySettings or MuteBell', (file) => {
    expect(read(file)).not.toMatch(/['"][^'"]*\b(NotifySettings|MuteBell)['"]/);
  });

  it.each(files)('%s does not pass `notifications` to SpolkySection', (file) => {
    const content = read(file);
    const match = content.match(/<SpolkySection[\s\S]*?\/>/);
    if (!match) return;
    expect(match[0]).not.toMatch(/\bnotifications\b/);
  });
});
