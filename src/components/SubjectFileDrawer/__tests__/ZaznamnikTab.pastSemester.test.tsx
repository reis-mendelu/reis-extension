import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const { fetchSubjectZaznamnik } = vi.hoisted(() => ({ fetchSubjectZaznamnik: vi.fn() }));
vi.mock('../../../api/zaznamnik', () => ({ fetchSubjectZaznamnik }));
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(), getAllWithKeys: vi.fn() },
}));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  INSTALL_ID_KEY: 'install_id',
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(), getAllWithKeys: vi.fn() },
}));

import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';

const POINTS = {
  ph: {
    sections: [
      {
        label: 'Průběžné hodnocení',
        arches: [{ name: 'Test 1', empty: false, columns: ['Body'], values: ['12'] }],
      },
    ],
    fetchedAt: 0,
  },
  vt: { tests: [], fetchedAt: 0 },
};

/** What the drawer's opening does: the tab only reads the store. */
const openDrawer = () => useAppStore.getState().loadPastZaznamnik('PS');

describe('ZaznamnikTab for a subject from an earlier semester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      language: 'cz',
      impersonation: null,
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      zaznamnik: {},
      zaznamnikLoading: {},
      subjects: {
        data: { PS: { subjectId: '789', periodId: '300', hasPrubezne: true, hasTest: true } },
      },
    } as never);
  });
  afterEach(cleanup);

  it('shows the loading skeleton, not an empty tab, until the points arrive, then the points', async () => {
    let release: (v: unknown) => void = () => {};
    fetchSubjectZaznamnik.mockReturnValue(new Promise((r) => (release = r)));

    const opening = openDrawer();
    const { container } = render(<ZaznamnikTab courseCode="PS" />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    await waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789'));

    release(POINTS);
    await opening;
    await waitFor(() => expect(screen.getByText('Test 1')).toBeTruthy());
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('offers a retry when the fetch fails', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(null);
    await openDrawer();
    render(<ZaznamnikTab courseCode="PS" />);
    await waitFor(() => expect(screen.getByTestId('zaznamnik-error')).toBeTruthy());
  });

  it("links to IS for the subject's own period, not the current one", async () => {
    fetchSubjectZaznamnik.mockResolvedValue(POINTS);
    await openDrawer();
    render(<ZaznamnikTab courseCode="PS" />);
    await waitFor(() => expect(screen.getByText('Test 1')).toBeTruthy());
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBe(2);
    for (const h of hrefs) {
      expect(h).toContain('obdobi=300;');
      expect(h).not.toContain('obdobi=456');
    }
  });

  it('is read-only: rendering the tab starts no fetch', () => {
    render(<ZaznamnikTab courseCode="PS" />);
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
  });
});
