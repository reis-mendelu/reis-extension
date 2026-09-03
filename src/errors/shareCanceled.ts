/**
 * The student dismissed the iOS share sheet. Not a failure.
 *
 * Reported as: "when a file is downloaded successfully from 'Studijni
 * dokumenty' and I cancel the dialog (where to save it), it just shows a
 * warning icon. That makes little sense."
 *
 * It made little sense because it was wrong. On iOS the file is written to the
 * app's Documents directory FIRST and the share sheet is offered afterwards —
 * see `openIsFile`'s `shareFile` — so by the time that sheet appears the
 * download has already succeeded. Cancelling it declines a destination, not the
 * document. `@capacitor/share` reports that decision by rejecting, and the row
 * turned every rejection into a warning triangle.
 *
 * Typed rather than a bare Error for the same reason `DemoModeError` is: one
 * handler can treat "the student chose not to" as the non-event it is while
 * real failures keep their own path — and neither should reach telemetry as a
 * crash.
 */
export class ShareCanceledError extends Error {
  constructor() {
    super('Share sheet dismissed by the student');
    this.name = 'ShareCanceledError';
  }
}

/**
 * Whether a rejection from the share sheet is a cancellation.
 *
 * Matched on the message because that is all the plugin gives: iOS rejects with
 * "Share canceled". The Web Share API signals the same thing as an
 * `AbortError`, which the dev webapp hits, so both are recognised.
 *
 * Deliberately narrow. Anything that is not recognisably a cancellation stays a
 * real error — a broad match here would silently swallow a genuine failure to
 * write the file, which is the one thing the student must be told about.
 */
export function isShareCancellation(e: unknown): boolean {
  if (e instanceof ShareCanceledError) return true;
  if (!(e instanceof Error)) return false;
  if (e.name === 'AbortError') return true;
  return /cancel(l)?ed/i.test(e.message);
}
