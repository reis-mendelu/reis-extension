import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

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

import { MenuSheet } from '../MenuSheet';
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';
import { useAppStore } from '../../../../store/useAppStore';

describe('MenuSheet and the ISIC row', () => {
  // PR #548 review: Android back and a tab switch remove the sheet through
  // popSheet / the stack, never through its close button, so the reset that
  // drops the balance has to run on unmount, whatever removed the sheet.
  it('drops the ISIC state when the sheet goes away by any route', () => {
    useAppStore.setState({ language: 'cz', menu: [] } as never);
    const reset = vi.fn();
    useIskamStore.setState({ reset });
    const { unmount } = render(<MenuSheet dayIso="2026-10-13" onClose={() => {}} />);
    expect(reset).not.toHaveBeenCalled();
    unmount();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
