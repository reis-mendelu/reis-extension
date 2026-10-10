import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

const usePersonPhoto = vi.hoisted(() => vi.fn(() => null as string | null));
vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));

const PHOTO = 'data:image/jpeg;base64,AAAA';

/**
 * The student's own avatar opens the same lightbox a classmate's does.
 *
 * Same rule as PersonSheet: a button only once there is a photo — initials
 * blown up to full screen are nothing to look at. And the lightbox goes on the
 * sheet STACK, so Android's back closes it and leaves the Profile tab where it
 * was.
 */
describe('the profile avatar', () => {
  const pushSheet = vi.fn();

  beforeEach(() => {
    pushSheet.mockClear();
    usePersonPhoto.mockReturnValue(null);
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'profile',
      mobileSheets: [],
      fullName: 'Jana Nováková',
      studentId: '123456',
      hiddenItems: { events: [], courses: [] },
      pushSheet,
    } as never);
  });

  it('enlarges the photo on tap', () => {
    usePersonPhoto.mockReturnValue(PHOTO);
    render(<ProfileScreen />);
    fireEvent.click(screen.getByLabelText('Zvětšit fotku'));
    expect(pushSheet).toHaveBeenCalledWith({
      kind: 'personPhoto',
      personId: '123456',
      name: 'Jana Nováková',
    });
  });

  it('offers nothing to enlarge while there is no photo, and shows initials', () => {
    render(<ProfileScreen />);
    expect(screen.queryByLabelText('Zvětšit fotku')).not.toBeInTheDocument();
    // Not even a disabled button: a screen reader would still announce one.
    expect(screen.getByText('JN').closest('button')).toBeNull();
  });

  it('is not a button at all before IS has told us who the student is', () => {
    useAppStore.setState({ studentId: null } as never);
    render(<ProfileScreen />);
    expect(screen.queryByLabelText('Zvětšit fotku')).not.toBeInTheDocument();
    expect(pushSheet).not.toHaveBeenCalled();
  });
});
