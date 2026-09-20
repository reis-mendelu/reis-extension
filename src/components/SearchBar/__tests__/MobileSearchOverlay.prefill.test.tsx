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
});
