import type { KeyboardEvent } from 'react';

/**
 * `onKeyDown` for a field whose text must not be lost to Escape.
 *
 * On a Mac (and an iPad with a keyboard) Escape closes the sheet or layer a
 * field sits in, and with it whatever was typed. With text in the field the
 * key is kept (`preventDefault`, which the sheet stack and every Escape layer
 * yield to) and nothing closes; an empty field leaves Escape to close as usual.
 * The same rule the report form keeps (useCloseReport).
 */
export function keepDraftOnEscape(draft: string) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Escape' && draft.trim() !== '') e.preventDefault();
  };
}
