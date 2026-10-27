import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'cz' }),
}));

const setIsOpen = vi.fn();
vi.mock('../useSearch', () => ({
  useSearch: () => ({
    setIsOpen,
    selectedIndex: -1,
    setSelectedIndex: vi.fn(),
    sections: [],
    filteredResults: [],
    isLoading: false,
    recentSearches: [],
    studiumId: '1',
    saveToHistory: vi.fn(),
    scope: 'faculty',
    canScopeToFaculty: false,
    widenToUniversity: vi.fn(),
    narrowToFaculty: vi.fn(),
  }),
}));

import { MobileSearchOverlay } from '../MobileSearchOverlay';
import { useEscapeLayer } from '../../../hooks/ui/useEscapeLayer';

function input() {
  return screen.getByPlaceholderText(/search\.placeholder/) as HTMLInputElement;
}

describe('MobileSearchOverlay query prefill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens with the prefilled query and leaves nothing behind after a close', () => {
    const { rerender } = render(
      <MobileSearchOverlay isOpen={false} onClose={() => {}} prefillQuery="" />
    );

    rerender(<MobileSearchOverlay isOpen={true} onClose={() => {}} prefillQuery="Matematika" />);
    expect(input().value).toBe('Matematika');

    // AppHeader clears its prefill as it closes the sheet.
    rerender(<MobileSearchOverlay isOpen={false} onClose={() => {}} prefillQuery="" />);
    rerender(<MobileSearchOverlay isOpen={true} onClose={() => {}} prefillQuery="" />);
    expect(input().value).toBe('');
  });

  it('keeps what the student types while the sheet stays open', () => {
    render(<MobileSearchOverlay isOpen={true} onClose={() => {}} prefillQuery="" />);
    fireEvent.change(input(), { target: { value: 'Fyzika' } });
    expect(input().value).toBe('Fyzika');
  });

  // An Escape layer: the overlay closes, and a drawer under it stays open.
  it('closes on Escape without closing the layer under it', () => {
    const under = vi.fn();
    const onClose = vi.fn();
    function Under() {
      useEscapeLayer(true, under);
      return null;
    }
    render(
      <>
        <Under />
        <MobileSearchOverlay isOpen onClose={onClose} prefillQuery="" />
      </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(under).not.toHaveBeenCalled();
  });
});
