import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonPhotoLightbox } from '../PersonPhotoLightbox';
import { useAppStore } from '../../../store/useAppStore';

const PHOTO = 'data:image/jpeg;base64,AAAA';

describe('PersonPhotoLightbox', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('shows the photo it was handed, labelled with whose face it is', () => {
    render(<PersonPhotoLightbox src={PHOTO} alt="Jan Novák" onClose={vi.fn()} />);
    expect(screen.getByAltText('Jan Novák')).toHaveAttribute('src', PHOTO);
  });

  it('renders nothing, and claims no Escape, without a photo', () => {
    const onClose = vi.fn();
    render(<PersonPhotoLightbox src={null} alt="Jan Novák" onClose={onClose} />);
    expect(screen.queryByTestId('person-photo-lightbox')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click outside the photo', () => {
    const onClose = vi.fn();
    render(<PersonPhotoLightbox src={PHOTO} alt="Jan Novák" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('person-photo-lightbox'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes ONCE from the X, not twice through the overlay behind it', () => {
    const onClose = vi.fn();
    render(<PersonPhotoLightbox src={PHOTO} alt="Jan Novák" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Zavřít'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<PersonPhotoLightbox src={PHOTO} alt="Jan Novák" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps its clicks from bubbling, through the portal, into whatever opened it', () => {
    // React events cross portals along the component tree. The hover card's
    // anchor toggles the card on click (touch), so a click on the lightbox
    // reaching it would reopen the card under the closing photo.
    const parent = vi.fn();
    render(
      <div onClick={parent}>
        <PersonPhotoLightbox src={PHOTO} alt="Jan Novák" onClose={vi.fn()} />
      </div>
    );
    fireEvent.click(screen.getByTestId('person-photo-lightbox'));
    fireEvent.click(screen.getByLabelText('Zavřít'));
    expect(parent).not.toHaveBeenCalled();
  });
});
