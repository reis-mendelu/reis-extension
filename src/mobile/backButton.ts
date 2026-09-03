import type { MobileTab } from '../store/types';

export interface BackPressState {
  sheetCount: number;
  popSheet(): void;
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
 * Innermost surface first: sheet → tab → exit. Calendar is the start
 * destination, which is how Android expects a bottom nav to behave — back from
 * Zkoušky/Předměty/Mapa/Student returns there, and only calendar quits.
 *
 * Pure on purpose: the @capacitor/app listener is a two-line adapter over this,
 * which keeps the decision testable without a device.
 */
export function handleBackPress({
  sheetCount,
  popSheet,
  tab,
  goToCalendar,
}: BackPressState): BackPressResult {
  // The vývěska used to need a branch of its own here, because it was a portal
  // outside the sheet stack. It is a sheet now — see sheets/BulletinSheet — so
  // the stack covers it, which is the point of having a stack.
  if (sheetCount > 0) {
    popSheet();
    return 'popped';
  }
  if (tab && tab !== 'calendar' && goToCalendar) {
    goToCalendar();
    return 'popped';
  }
  return 'exit';
}
