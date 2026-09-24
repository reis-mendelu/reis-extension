import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { nextSelectedIndex } from '../../../../utils/mobile/listNavigation';

/**
 * Keyboard navigation for the search sheet's list, which it never had: it
 * rendered the same `role="option"` rows as the desktop dropdown and wired
 * none of the combobox behaviour, so on an iPad with a keyboard you could type
 * a search and then not pick a result.
 *
 * The cursor lives in the sheet rather than in the rows, and the rows stay
 * unfocusable — that is the combobox contract the desktop already follows:
 * focus never leaves the input, and `aria-activedescendant` names the row a
 * screen reader should announce.
 *
 * The cursor is keyed to the list it belongs to (`listKey`), and reset by
 * DERIVING rather than by an effect: any change of mode, query, length or
 * expanded categories is a new set of rows, and an index held over from the old
 * one points at whatever happens to occupy that position now. An effect would
 * also have set state during render — which the repo lints against, correctly.
 *
 * Split out of `SearchSheet` for the file-length convention.
 */
export function useListCursor(listKey: string, length: number, openAt: (index: number) => void) {
  const [cursor, setCursor] = useState({ key: listKey, index: -1 });
  const selected = cursor.key === listKey ? cursor.index : -1;
  const setSelected = (index: number) => setCursor({ key: listKey, index });

  const onNavigate = (e: KeyboardEvent<HTMLInputElement>): boolean => {
    const moved = nextSelectedIndex(selected, length, e.key);
    if (moved !== null) {
      setSelected(moved);
      // The browser would otherwise run the caret to the end of the query.
      e.preventDefault();
      return true;
    }
    if (e.key === 'Enter' && selected >= 0) {
      openAt(selected);
      e.preventDefault();
      return true;
    }
    if (e.key === 'Escape' && selected >= 0) {
      setSelected(-1);
      e.preventDefault();
      return true;
    }
    return false;
  };

  return { selected, onNavigate };
}
