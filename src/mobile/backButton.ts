export interface BackPressState {
  sheetCount: number;
  popSheet(): void;
}

export type BackPressResult = 'popped' | 'exit';

/**
 * Android's hardware back must unwind the sheet stack before it exits the app.
 * The stack genuinely nests (Student → person, Subjects → drawer → confirm), so
 * one press pops exactly one level.
 *
 * Pure on purpose: the @capacitor/app listener is a two-line adapter over this,
 * which keeps the decision testable without a device.
 */
export function handleBackPress({ sheetCount, popSheet }: BackPressState): BackPressResult {
  if (sheetCount > 0) {
    popSheet();
    return 'popped';
  }
  return 'exit';
}
