import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonPhotoSheet } from '../PersonPhotoSheet';
import { useAppStore } from '../../../../store/useAppStore';

const usePersonPhoto = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));

const PHOTO = 'data:image/jpeg;base64,AAAA';

describe('PersonPhotoSheet', () => {
  beforeEach(() => {
    usePersonPhoto.mockReturnValue(PHOTO);
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('shows the photo full-bleed, labelled with whose face it is', () => {
    render(
      <PersonPhotoSheet
        sheet={{ kind: 'personPhoto', personId: '42', name: 'Jan Novák' }}
        onClose={vi.fn()}
      />
    );
    const img = screen.getByAltText('Jan Novák');
    expect(img).toHaveAttribute('src', PHOTO);
  });

  it('closes when the photo is tapped again', () => {
    // The whole overlay is the dismiss target. A student who tapped a face to
    // enlarge it expects the next tap anywhere to put it back — hunting for an
    // X in a corner is a desktop habit.
    const onClose = vi.fn();
    render(
      <PersonPhotoSheet
        sheet={{ kind: 'personPhoto', personId: '42', name: 'Jan Novák' }}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByTestId('person-photo-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes itself rather than showing an empty frame when the photo is gone', () => {
    // usePersonPhoto returns null while the fetch is in flight AND when it
    // failed. Reaching this sheet means the avatar had already resolved, so a
    // null here is the failure case — a black rectangle with nothing in it is
    // worse than never having opened.
    usePersonPhoto.mockReturnValue(null);
    const onClose = vi.fn();
    render(
      <PersonPhotoSheet
        sheet={{ kind: 'personPhoto', personId: '42', name: 'Jan Novák' }}
        onClose={onClose}
      />
    );
    expect(screen.queryByAltText('Jan Novák')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
