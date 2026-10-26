import { contrastRatio } from '../readableTextColor';

/**
 * The pin must stay visible on the campus basemap, which is always light.
 *
 * 2:1, not WCAG's 3:1 for graphics: 3:1 rejects ESN's own cyan (2.5:1), which
 * has been on the map since launch and reads fine with the pin's outline. 2:1
 * still rejects what actually disappears: EY's yellow (1.3:1), and near-whites.
 */
export const MIN_PIN_CONTRAST = 2;

export function isUsablePinColor(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  return contrastRatio(hex, '#ffffff') >= MIN_PIN_CONTRAST;
}
