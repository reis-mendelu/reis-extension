/**
 * Where the keyboard cursor goes next in a results list.
 *
 * Pure, because the interesting part is the edges — an empty list, a stale
 * index that outlived a longer one, entering from either end — and none of that
 * is worth discovering through a rendered component.
 *
 * Wraps rather than stopping: these lists are short (three recents is typical)
 * and a cursor that sticks at the last row reads as broken rather than as a
 * boundary. Matches the desktop SearchBar, which students may have used first.
 *
 * Returns `null` for a key that is not navigation, so the caller can tell
 * "unchanged" from "moved to -1" and leave the event alone.
 */
export function nextSelectedIndex(current: number, length: number, key: string): number | null {
  if (key !== 'ArrowDown' && key !== 'ArrowUp') return null;
  // Nothing to point at. Deliberately -1 rather than 0: Enter must not then
  // "activate" a row that is not there.
  if (length <= 0) return -1;
  const down = key === 'ArrowDown';
  // A stale index — results replaced a longer set — is treated as no selection
  // rather than clamped, so the next press enters the list cleanly from an end.
  const from = current >= 0 && current < length ? current : -1;
  if (from === -1) return down ? 0 : length - 1;
  return down ? (from + 1) % length : (from - 1 + length) % length;
}
