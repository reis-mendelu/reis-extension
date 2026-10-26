import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { EduroamDrawer } from '../EduroamDrawer';
import { useAppStore } from '../../../store/useAppStore';
import { fetchEduroamCertMaterial, regenerateEduroamCert } from '../../../api/eduroam';
import { deliverEduroamProfile } from '../../../mobile/eduroamProfile';

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn().mockResolvedValue({
    rootCaDer: new Uint8Array([1]),
    clientP12: new Uint8Array([2]),
    password: 'pw123',
    generated: false,
    expiresAt: new Date('2025-01-01T12:00:00Z'),
  }),
  fetchEduroamPassword: vi.fn().mockResolvedValue('pw123'),
  regenerateEduroamCert: vi.fn(async () => {}),
}));
vi.mock('../../../mobile/eduroamProfile', () => ({
  deliverEduroamProfile: vi.fn(async () => {}),
  buildProfileDelivery: vi.fn(() => ({ kind: 'web' })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAppStore.setState({ isEduroamOpen: false, eduroamInitialTarget: null });
});

/**
 * The extension's half of the expiry fix. A Mac or Windows profile built from
 * an expired certificate installs fine and then never authenticates, so the
 * drawer must stop and offer a new certificate exactly as the phone does.
 */
describe('EduroamDrawer with an expired certificate', () => {
  it('says the certificate expired and hands over no profile', async () => {
    useAppStore.setState({ isTouch: false, isNarrow: false, language: 'en' });
    useAppStore.getState().openEduroamFor('windows');
    render(<EduroamDrawer />);

    fireEvent.click(screen.getByRole('button', { name: 'Download eduroam profile' }));

    expect(await screen.findByText(/expired on 01\.01\.2025/)).toBeTruthy();
    expect(deliverEduroamProfile).not.toHaveBeenCalled();
    expect(regenerateEduroamCert).not.toHaveBeenCalled();
  });

  it('generates a new certificate only when the student asks', async () => {
    useAppStore.setState({ isTouch: false, isNarrow: false, language: 'en' });
    useAppStore.getState().openEduroamFor('windows');
    render(<EduroamDrawer />);

    fireEvent.click(screen.getByRole('button', { name: 'Download eduroam profile' }));
    fireEvent.click(await screen.findByRole('button', { name: /Generate a new certificate/i }));

    await waitFor(() => expect(regenerateEduroamCert).toHaveBeenCalledTimes(1));
  });

  // The current certificate keeps working until its expiry (IS does not revoke
  // on regeneration), so the profile is still handed over — with the offer.
  it('hands over the profile and offers an early renewal when expiry is near', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockResolvedValueOnce({
      rootCaDer: new Uint8Array([1]),
      clientP12: new Uint8Array([2]),
      password: 'pw123',
      generated: false,
      expiresAt: new Date(Date.now() + 10 * 86_400_000),
    });
    useAppStore.setState({ isTouch: false, isNarrow: false, language: 'en' });
    useAppStore.getState().openEduroamFor('windows');
    render(<EduroamDrawer />);

    fireEvent.click(screen.getByRole('button', { name: 'Download eduroam profile' }));

    expect(await screen.findByText(/expires on/)).toBeTruthy();
    expect(deliverEduroamProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Generate a new certificate/i })).toBeTruthy();
  });
});

/**
 * The extension opens on is.mendelu.cz, so it starts online — but a laptop can
 * drop its connection with the page still open, and the fetch then fails with
 * the browser's raw "Failed to fetch".
 */
describe('EduroamDrawer without a network', () => {
  it('says IS could not be reached instead of the raw fetch error', async () => {
    vi.mocked(fetchEduroamCertMaterial).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    useAppStore.setState({ isTouch: false, isNarrow: false, language: 'en' });
    useAppStore.getState().openEduroamFor('windows');
    render(<EduroamDrawer />);

    fireEvent.click(screen.getByRole('button', { name: 'Download eduroam profile' }));

    expect(await screen.findByText(/Couldn't reach IS/)).toBeTruthy();
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });
});
