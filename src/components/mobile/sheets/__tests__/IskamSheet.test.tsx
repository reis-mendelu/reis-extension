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
      reset: vi.fn(),
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
  // unmount, whatever removed the sheet.
  it('drops the ISIC state when the sheet goes away by any route', () => {
    const reset = vi.fn();
    useIskamStore.setState({ reset });
    const { unmount } = render(<IskamSheet onClose={() => {}} />);
    expect(reset).not.toHaveBeenCalled();
    unmount();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
