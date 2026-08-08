import type { MobileTab } from '../store/types';

export interface BackPressState {
  sheetCount: number;
  popSheet(): void;
  /**
   * The vývěska overlay, which is NOT part of the sheet stack: it has its own
   * `bulletinExpanded` store flag and portals to document.body. Without it here
   * the stack reads as empty and back quits the app out from under a student
   * reading the noticeboard.
   */
  bulletinOpen?: boolean;
  closeBulletin?(): void;
  /**
   * The bottom-nav tab in view. Optional because this listener is registered
   * before boot, so it also fires while the login WebView is up and no tab
   * exists yet — that case must still exit.
   */
  tab?: MobileTab;
  goToCalendar?(): void;
}

export type BackPressResult = 'popped' | 'exit';

/**
 * Android's hardware back must unwind the sheet stack before it exits the app.
 * The stack genuinely nests (Student → person, Subjects → drawer → confirm), so
 * one press pops exactly one level.
 *
 * Innermost surface first: sheet → bulletin → tab → exit. Calendar is the start
 * destination, which is how Android expects a bottom nav to behave — back from
 * Zkoušky/Předměty/Mapa/Student returns there, and only calendar quits.
 *
 * Pure on purpose: the @capacitor/app listener is a two-line adapter over this,
 * which keeps the decision testable without a device.
 */
export function handleBackPress({
  sheetCount,
  popSheet,
  bulletinOpen,
  closeBulletin,
  tab,
  goToCalendar,
}: BackPressState): BackPressResult {
  // Sheets first: one opened on top of the bulletin is drawn above it, so
  // closing the overlay underneath would look like nothing happened.
  if (sheetCount > 0) {
    popSheet();
    return 'popped';
  }
  if (bulletinOpen && closeBulletin) {
    closeBulletin();
    return 'popped';
  }
  if (tab && tab !== 'calendar' && goToCalendar) {
    goToCalendar();
    return 'popped';
  }
  return 'exit';
}
