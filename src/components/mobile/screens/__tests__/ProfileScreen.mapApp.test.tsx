import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));
// An iPhone, the one platform where a map-app choice ever existed.
vi.mock('../../../../platform', async (orig) => ({
  ...(await orig<typeof import('../../../../platform')>()),
  getPlatform: () => ({ kind: 'capacitor' }),
}));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true },
}));

/**
 * Profil has no "Mapy" setting. A venue tap asks every time — Apple Mapy or
 * Google Maps — the way the phone's own share sheets do, so there is no stored
 * choice for a setting to manage. The row used to offer Apple / Google / Vždy
 * se zeptat; "pamatuješ si, jak jsme odstranili ty mapy v profilu? … always
 * ask".
 */
describe('ProfileScreen — no map-app setting', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', fullName: 'Jan Novák', studentId: '120344' } as never);
  });

  it('shows no Mapy row, even on an iPhone', () => {
    render(<ProfileScreen />);
    expect(screen.queryByTestId('map-app-row')).not.toBeInTheDocument();
    expect(screen.queryByText('Vždy se zeptat')).not.toBeInTheDocument();
  });
});
