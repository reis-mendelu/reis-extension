import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURE_SIGNALS } from '../../api/featureUsage';

/**
 * Every `screen_*` counter fires on BOTH trees (2026-11-07). A screen counted
 * on the phone only would make the admin console's "share of daily installs"
 * silently a phone number, and nothing on the panel would say so.
 *
 * Each label is pinned to the file that shows the surface in each tree. A
 * counter fires when the surface is SHOWN — a mount, or the open state of a
 * surface that stays mounted — never per tap.
 *
 * Deliberate omissions, so they are not "fixed" later:
 * - The map has no `screen_map`: `map_dwell_3s` (`hooks/useMapDwell`, mounted
 *   by both map surfaces) already answers "opened the map", with a three-second
 *   floor that drops a tab passed through, and history back to September.
 * - The phone's Den menu card (`MenuCard`) is not `screen_menu`: it sits under
 *   every day, so it would count the calendar a second time. Only an opened
 *   menu counts — the sheet on the phone, the chef-hat popover in the extension.
 * - Vývěska (`bulletin`, IS posts behind the pin) and Novinky (`notifications`,
 *   the feed behind the bell) are two surfaces with two labels.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const SCREENS: Record<string, { phone: string[]; extension: string[] }> = {
  screen_calendar: {
    phone: ['components/mobile/screens/CalendarScreen.tsx'],
    extension: ['components/WeeklyCalendar/index.tsx'],
  },
  screen_subjects: {
    phone: ['components/mobile/screens/SubjectsScreen.tsx'],
    extension: ['components/SubjectsPanel/index.tsx'],
  },
  screen_menu: {
    phone: ['components/mobile/sheets/MenuSheet.tsx'],
    extension: ['components/WeeklyCalendar/WeeklyCalendarHeader.tsx'],
  },
  screen_search: {
    phone: ['components/mobile/sheets/SearchSheet.tsx'],
    // Three ways in: the narrow header's overlay, the sidebar's Lidé popover,
    // and the subject search on Studijní plán.
    extension: [
      'components/SearchBar/MobileSearchOverlay.tsx',
      'components/SearchBar/PeopleSearchPopover.tsx',
      'components/SearchBar/index.tsx',
    ],
  },
  screen_bulletin: {
    phone: ['components/mobile/sheets/BulletinSheet.tsx'],
    extension: ['components/Bulletin/BulletinBanner.tsx'],
  },
  screen_notifications: {
    phone: ['components/mobile/sheets/NotificationsSheet.tsx'],
    extension: ['components/Notifications/NotificationDropdown.tsx'],
  },
};

describe('screen counters fire on both trees', () => {
  it('every screen_* label the client sends is pinned here', () => {
    const sent = FEATURE_SIGNALS.filter((s) => s.startsWith('screen_')).sort();
    expect(Object.keys(SCREENS).sort()).toEqual(sent);
  });

  for (const [signal, trees] of Object.entries(SCREENS)) {
    for (const [tree, files] of Object.entries(trees)) {
      it.each(files)(`${signal} fires on the ${tree} tree in %s`, (file) => {
        expect(read(file)).toMatch(new RegExp(`useScreenSignal\\(\\s*'${signal}'`));
      });
    }
  }

  // These three stay mounted while closed, so without their open flag the
  // extension's search and vývěska would read close to 100 %.
  it.each([
    ['components/SearchBar/MobileSearchOverlay.tsx', "useScreenSignal('screen_search', isOpen)"],
    ['components/SearchBar/index.tsx', "useScreenSignal('screen_search', isOpen)"],
    ['components/Bulletin/BulletinBanner.tsx', "useScreenSignal('screen_bulletin', expanded)"],
  ])('%s counts only while open', (file, call) => {
    expect(read(file)).toContain(call);
  });

  it('the map keeps map_dwell_3s on both trees instead', () => {
    expect(FEATURE_SIGNALS).not.toContain('screen_map');
    expect(read('components/mobile/screens/MapScreen.tsx')).toContain('useMapDwell()');
    expect(read('components/CampusMap/CampusMapView.tsx')).toContain('useMapDwell()');
  });

  it('the Den menu card stays uncounted', () => {
    expect(read('components/mobile/screens/calendar/MenuCard.tsx')).not.toContain(
      'useScreenSignal'
    );
  });
});
