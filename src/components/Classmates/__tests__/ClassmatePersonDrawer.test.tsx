import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassmatePersonDrawer } from '../ClassmatePersonDrawer';
import { useAppStore } from '../../../store/useAppStore';
import type { Classmate } from '../../../types/classmates';

const usePersonPhoto = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));
vi.mock('../../../hooks/data/usePersonProfile', () => ({
  usePersonProfile: () => ({ profile: null, isLoading: false }),
}));

const PHOTO = 'data:image/jpeg;base64,AAAA';
const JAN = { personId: 42, name: 'Jan Novák', studyInfo: '' } as unknown as Classmate;

describe('ClassmatePersonDrawer photo', () => {
  beforeEach(() => {
    usePersonPhoto.mockReturnValue(PHOTO);
    useAppStore.setState({ language: 'cz', isTouch: false, isNarrow: false } as never);
  });

  it("opens the classmate's photo enlarged on click", () => {
    render(<ClassmatePersonDrawer classmate={JAN} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zvětšit fotku' }));
    const lightbox = screen.getByTestId('person-photo-lightbox');
    expect(lightbox.querySelector('img')).toHaveAttribute('src', PHOTO);
  });

  it('Escape closes the photo first and leaves the drawer open', () => {
    const onClose = vi.fn();
    render(<ClassmatePersonDrawer classmate={JAN} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zvětšit fotku' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('person-photo-lightbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a click outside the photo closes the photo, not the drawer', () => {
    const onClose = vi.fn();
    render(<ClassmatePersonDrawer classmate={JAN} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zvětšit fotku' }));
    fireEvent.click(screen.getByTestId('person-photo-lightbox'));
    expect(screen.queryByTestId('person-photo-lightbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers nothing to enlarge while there is no photo, only the glyph', () => {
    usePersonPhoto.mockReturnValue(null);
    render(<ClassmatePersonDrawer classmate={JAN} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Zvětšit fotku' })).toBeNull();
  });
});
