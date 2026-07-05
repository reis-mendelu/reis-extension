import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentsDrawer } from '../DocumentsDrawer';
import { useAppStore } from '../../../store/useAppStore';
import * as proxy from '../../../api/proxyClient';

vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: { studium: '149707' } }) }));

describe('DocumentsDrawer', () => {
  beforeEach(() => { useAppStore.setState({ isDocumentsOpen: true, language: 'cz' }); });
  afterEach(() => { vi.restoreAllMocks(); useAppStore.setState({ isDocumentsOpen: false }); });

  it('renders a row per catalog document plus the Žádost link', () => {
    render(<DocumentsDrawer />);
    expect(screen.getByText('Potvrzení o studiu')).toBeTruthy();
    expect(screen.getByText('Confirmation of study')).toBeTruthy();
    expect(screen.getByText('Tisk registračního archu')).toBeTruthy();
  });

  it('downloads on row click and shows completion', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    render(<DocumentsDrawer />);
    fireEvent.click(screen.getByText('Potvrzení o studiu'));
    expect(spy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium=149707;lang=cz',
      'Potvrzeni_o_studiu.pdf',
    );
    await waitFor(() => expect(screen.getByLabelText('done')).toBeTruthy());
  });
});
