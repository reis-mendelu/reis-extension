import type { KeyboardEvent } from 'react';

/**
 * The Erasmus pickers' keys. Escape closes an OPEN list and keeps the key, so
 * the drawer around the picker stays (useEscapeLayer yields to
 * `preventDefault`); with the list closed it is left to the drawer. Enter takes
 * the top result of the open list, if there is one.
 */
export function pickerKeyDown<T>(
  e: KeyboardEvent,
  isOpen: boolean,
  setOpen: (open: boolean) => void,
  first: T | undefined,
  pick: (first: T) => void
) {
  if (e.key === 'Escape' && isOpen) {
    e.preventDefault();
    setOpen(false);
  }
  // Only from the list on screen: after Escape it still holds the old results,
  // and Enter picked one nobody could see (release review).
  if (e.key === 'Enter' && isOpen && first !== undefined) {
    pick(first);
    setOpen(false);
  }
}
