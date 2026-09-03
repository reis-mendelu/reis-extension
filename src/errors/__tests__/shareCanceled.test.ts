import { describe, it, expect } from 'vitest';
import { ShareCanceledError, isShareCancellation } from '../shareCanceled';

/**
 * Cancelling the save dialog is a decision, not a fault.
 *
 * The row showed a warning triangle for it, because on iOS the file is written
 * to Documents before the share sheet is offered and `@capacitor/share` reports
 * a dismissal by rejecting — so a successful download ended in an error icon.
 */
describe('isShareCancellation', () => {
  it('recognises its own typed error', () => {
    expect(isShareCancellation(new ShareCanceledError())).toBe(true);
  });

  it("recognises the iOS plugin's rejection", () => {
    // The exact message @capacitor/share rejects with on dismissal.
    expect(isShareCancellation(new Error('Share canceled'))).toBe(true);
  });

  it('recognises both spellings, since this is matched on prose', () => {
    expect(isShareCancellation(new Error('Share cancelled'))).toBe(true);
  });

  it("recognises the Web Share API's AbortError, which the dev webapp raises", () => {
    const e = new Error('Abort due to cancellation of share.');
    e.name = 'AbortError';
    expect(isShareCancellation(e)).toBe(true);
  });

  /**
   * The narrowness is the point. A broad match would swallow a genuine failure
   * to write the file — the one outcome the student has to be told about.
   */
  it('leaves a real failure a real failure', () => {
    expect(isShareCancellation(new Error('Document was not saved: potvrzeni.pdf'))).toBe(false);
    expect(isShareCancellation(new Error('Filesystem write failed'))).toBe(false);
    expect(isShareCancellation(new Error('Network request failed'))).toBe(false);
  });

  it('is not fooled by a non-error', () => {
    expect(isShareCancellation('canceled')).toBe(false);
    expect(isShareCancellation(null)).toBe(false);
    expect(isShareCancellation(undefined)).toBe(false);
  });
});
