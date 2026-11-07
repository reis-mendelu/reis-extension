import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamTopUp', () => ({
  initTopUp: vi.fn(),
  openGateway: vi.fn(),
}));
vi.mock('../../../../mobile/iskam/iskamLogin', () => ({
  signInToIskam: vi.fn(),
  buildIskamLoginDeps: async () => ({}),
}));

import { IskamSheet } from '../IskamSheet';
import { SheetHost } from '../SheetHost';
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';
import { useAppStore } from '../../../../store/useAppStore';

describe('IskamSheet (the profile way into the ISIC row)', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
    useIskamStore.setState({
      status: 'balance',
      balance: { amount: 2825.58 },
      lastTopUp: null,
    });
  });

  it('shows the same balance row Jídelníček does', () => {
    render(<IskamSheet onClose={() => {}} />);
    expect(screen.getByTestId('iskam-row')).toBeInTheDocument();
    expect(screen.getByTestId('iskam-amount').textContent).toMatch(/2\s?825,58/);
  });

  it('SheetHost opens it for kind isic', () => {
    useAppStore.setState({ mobileSheets: [{ kind: 'isic' }] } as never);
    render(<SheetHost />);
    expect(screen.getByTestId('iskam-row')).toBeInTheDocument();
  });

  // Same rule as MenuSheet (PR #548 review): Android back and a tab switch
  // remove a sheet without its close button, so the balance is dropped on
  // unmount, whatever removed the sheet. The real reset, and the store after it.
  it('drops the balance when the sheet goes away by any route', async () => {
    const { unmount } = render(<IskamSheet onClose={() => {}} />);
    unmount();
    await Promise.resolve();
    expect(useIskamStore.getState().status).toBe('hidden');
    expect(useIskamStore.getState().balance).toBeNull();
  });

  // Review #645: StrictMode runs setup → cleanup → setup on mount in dev, and a
  // reset in that simulated unmount dropped the check the tap had started,
  // leaving the sheet empty. Jídelníček's sheet had the same hole.
  it("keeps the balance through StrictMode's double mount", async () => {
    render(
      <StrictMode>
        <IskamSheet onClose={() => {}} />
      </StrictMode>
    );
    await Promise.resolve();
    expect(useIskamStore.getState().status).toBe('balance');
    expect(screen.getByTestId('iskam-amount')).toBeInTheDocument();
  });
});
