import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentsDrawer } from '../DocumentsDrawer';
import { useAppStore } from '../../../store/useAppStore';
import * as proxy from '../../../api/proxyClient';
import { useUserParams } from '../../../hooks/useUserParams';

vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: vi.fn(() => ({ params: { studium: '149707' } })) }));

describe('DocumentsDrawer', () => {
  beforeEach(() => {
    useAppStore.setState({ isDocumentsOpen: true, language: 'cz' });
    vi.mocked(useUserParams).mockReturnValue({ params: { studium: '149707' }, loading: false } as never);
  });
  afterEach(() => {
    // Unmount before resetting store state: this local afterEach runs before
    // RTL's automatic global cleanup, so setting isDocumentsOpen (which
    // DocumentsDrawer subscribes to) on a still-mounted instance would fire
    // an unwrapped act() update. Explicit cleanup() first avoids that.
    cleanup();
    vi.restoreAllMocks();
    useAppStore.setState({ isDocumentsOpen: false });
  });

  it('renders a row per catalog document plus the Žádost link', () => {
    render(<DocumentsDrawer />);
    expect(screen.getByText('Potvrzení o studiu')).toBeTruthy();
    expect(screen.getByText('Confirmation of study')).toBeTruthy();
    expect(screen.getByText('Tisk registračního archu')).toBeTruthy();
  });

  it('downloads on row click and shows completion', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    render(<DocumentsDrawer />);
    await act(async () => {
      fireEvent.click(screen.getByText('Potvrzení o studiu'));
    });
    expect(spy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz',
      'Potvrzeni_o_studiu.pdf',
    );
    await waitFor(() => expect(screen.getByLabelText('done')).toBeTruthy());
  });

  it('shows the error status when the download rejects', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('boom'));
    render(<DocumentsDrawer />);
    await act(async () => {
      fireEvent.click(screen.getByText('Potvrzení o studiu'));
    });
    await waitFor(() => expect(screen.getByLabelText('error')).toBeTruthy());
  });

  it('disables the Žádost link when studium is empty', () => {
    vi.mocked(useUserParams).mockReturnValue({ params: { studium: '' }, loading: false } as never);
    render(<DocumentsDrawer />);
    const link = screen.getByText('Žádost na studijní oddělení').closest('a') as HTMLAnchorElement;
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders a header with the title and a working close button', () => {
    render(<DocumentsDrawer />);
    expect(screen.getByRole('heading', { name: 'Studijní dokumenty' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Zavřít'));
    expect(useAppStore.getState().isDocumentsOpen).toBe(false);
  });
});
