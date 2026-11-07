import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const offered = vi.fn(() => true);
const check = vi.fn(async () => {});
vi.mock('../../../../../mobile/iskam/iskamStore', () => ({
  iskamOffered: () => offered(),
  useIskamStore: { getState: () => ({ check }) },
}));

import { IskamProfileRow } from '../IskamProfileRow';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * "Put ISIC top up into profile on phone" (Task List, 2026-11-07): very few
 * students realised the balance and Dobít were inside Jídelníček. The profile
 * gets a way in that opens the same row, and Jídelníček keeps its own.
 */
describe('IskamProfileRow', () => {
  beforeEach(() => {
    offered.mockReturnValue(true);
    check.mockClear();
    useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
  });

  it('offers ISIC on the profile where WebISKAM can be reached', () => {
    render(<IskamProfileRow />);
    expect(screen.getByRole('button', { name: /ISIC/ })).toBeInTheDocument();
    expect(screen.getByText('zůstatek a dobití')).toBeInTheDocument();
  });

  it('is absent where it cannot (extension, dev web, demo)', () => {
    offered.mockReturnValue(false);
    const { container } = render(<IskamProfileRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts the balance check from the tap, once, and opens the ISIC sheet', () => {
    render(<IskamProfileRow />);
    expect(check).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /ISIC/ }));
    expect(check).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'isic' }]);
  });
});
