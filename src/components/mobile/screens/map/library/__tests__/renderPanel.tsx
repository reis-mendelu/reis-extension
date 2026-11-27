import { render } from '@testing-library/react';
import { LibraryCard } from '../LibraryCard';
import { LibraryBar } from '../LibraryBar';

/** The map's panel: the card, and the footer that books what it picked. */
export const renderPanel = (flush = false) =>
  render(
    <>
      <LibraryCard view={{ featureId: null }} flush={flush} />
      <LibraryBar flush={flush} />
    </>
  );
