import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));

const platform = vi.fn<() => 'ios' | 'android' | 'web'>(() => 'ios');
vi.mock('../../../../mobile/nativeMapPlatform', () => ({
  nativeMapPlatform: () => platform(),
}));

/**
 * "clicking anywhere on 'mapy' row in the settings makes it disappear"
 *
 * The row was a single `<button>` over the whole width whose `onClick` was
 * `setPreferredMapApp(null)`, rendered under `{preferredMapApp && …}`. So the
 * row's only action cleared the value the row's existence depended on: one tap
 * anywhere — the icon, the label, the current value — and it unmounted. The
 * student had no way back to being asked, and nothing on screen explained where
 * the row went.
 *
 * It is a segmented control now, like the language row above it: three explicit
 * options, one of them "always ask", and the row stays put whichever is on.
 */
describe('ProfileScreen — the map app row', () => {
  beforeEach(() => {
    platform.mockReturnValue('ios');
    useAppStore.setState({
      language: 'cz',
      fullName: 'Jan Novák',
      studentId: '120344',
      preferredMapApp: 'apple',
    } as never);
  });

  const row = () => screen.queryByTestId('map-app-row');
  // Real Czech strings, not i18n keys: this suite's `useTranslation` resolves
  // against cs.json, so asserting on keys would pass while the row rendered
  // "map.mapApp" to a student. It also means a deleted string fails here.
  const ASK = 'Vždy se zeptat';

  it('survives a tap on its own label — the reported bug', () => {
    render(<ProfileScreen />);
    expect(row()).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mapy'));

    expect(row()).toBeInTheDocument();
    expect(useAppStore.getState().preferredMapApp).toBe('apple');
  });

  // The row used to exist only while something was stored, so "ask me every
  // time" was a state you could enter and never leave or re-enter.
  it('stays on screen when the choice is "always ask"', () => {
    useAppStore.setState({ preferredMapApp: null } as never);
    render(<ProfileScreen />);

    expect(row()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ASK })).toHaveAttribute('aria-pressed', 'true');
  });

  it('remembers the app the student picks', async () => {
    useAppStore.setState({ preferredMapApp: null } as never);
    render(<ProfileScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Google Maps' }));

    await waitFor(() => expect(useAppStore.getState().preferredMapApp).toBe('google'));
    expect(row()).toBeInTheDocument();
  });

  it('goes back to being asked, without the row vanishing', async () => {
    render(<ProfileScreen />);

    fireEvent.click(screen.getByRole('button', { name: ASK }));

    await waitFor(() => expect(useAppStore.getState().preferredMapApp).toBe(null));
    expect(row()).toBeInTheDocument();
  });

  // `openVenue` resolves the preference straight to a `geo:` URL on Android and
  // never asks, so the setting cannot change anything there.
  it('is absent on Android, where the system chooser cannot be overridden', () => {
    platform.mockReturnValue('android');
    render(<ProfileScreen />);

    expect(row()).not.toBeInTheDocument();
  });

  it('is absent in a browser, which has one map URL and nothing to choose', () => {
    platform.mockReturnValue('web');
    render(<ProfileScreen />);

    expect(row()).not.toBeInTheDocument();
  });
});
