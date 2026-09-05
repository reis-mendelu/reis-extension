import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchSheet } from '../SearchSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SearchResult } from '../../../SearchBar/types';

/**
 * The gap CodeRabbit's review pointed at, once the actual cause was found.
 *
 * `SearchResultItem` was never the problem: it carries `role="option"` and
 * `aria-selected` and is deliberately unfocusable, which is correct for the
 * combobox the DESKTOP SearchBar implements — its input owns Arrow/Enter and
 * focus never leaves it. The mobile sheet rendered the same rows and wired none
 * of that, so on an iPad with a keyboard you could type a search and then not
 * pick a result.
 */
const subject = (id: string, title: string): SearchResult => ({
  id,
  title,
  type: 'subject',
  subjectCode: id,
});

describe('SearchSheet — picking a result with the keyboard', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      recentSubjects: [subject('ALG', 'Algoritmizace'), subject('MAT', 'Matematika')],
      subjects: null,
      studyPlanDual: null,
      studiumId: null,
      userFaculty: null,
      userSemester: null,
      isNarrow: true,
      executeSearch: vi.fn().mockResolvedValue({ people: [], subjects: [] }),
    } as never);
  });

  const openSubjectsTab = () => {
    render(<SearchSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Předměty' }));
    // By its textbox role: this field is deliberately not a combobox or a
    // searchbox — see StudentSearch.
    return screen.getByRole('textbox');
  };

  it('moves a cursor through the list without focus leaving the input', () => {
    const input = openSubjectsTab();
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Algoritmizace').closest('[role="option"]')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // The input keeps the cursor and names the active row, which is what a
    // screen reader reads out — the row itself is never focused.
    expect(input).toHaveAttribute('aria-activedescendant', 'mobile-search-option-0');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Matematika').closest('[role="option"]')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  // The actual point of the whole thing: Return opens what the arrows landed on.
  it('opens the selected subject on Return', () => {
    const input = openSubjectsTab();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useAppStore.getState().mobileSheets).toEqual([
      expect.objectContaining({ kind: 'subjectDrawer', courseCode: 'ALG' }),
    ]);
  });

  // Return kept its old job — dropping the iPad's keyboard — for when there is
  // nothing selected to open. Losing that would be a regression on the gesture
  // the field was built around.
  it('still just dismisses the keyboard when nothing is selected', () => {
    const input = openSubjectsTab();
    const blur = vi.spyOn(input, 'blur');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(blur).toHaveBeenCalled();
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });

  it('gives the cursor up on Escape', () => {
    const input = openSubjectsTab();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});
