import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SearchSheet } from '../SearchSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { pagesData } from '../../../../data/pages';
import { DemoModeError } from '../../../../errors/demoMode';

/**
 * "Starý IS": the IS page directory, back on the phone as the sheet's third
 * segment. #257 took it away because every link landed in the system browser
 * with no IS session; #292 made openExternal carry the session into an in-app
 * WebView, which removed that reason.
 */
const openExternal = vi.hoisted(() => vi.fn());
vi.mock('../../../../mobile/openExternal', () => ({ openExternal }));

const logError = vi.hoisted(() => vi.fn());
vi.mock('../../../../utils/reportError', () => ({ logError }));

const PORTAL_STUDENTA = 'https://is.mendelu.cz/auth/student/moje_studium.pl?lang=cz';

describe('SearchSheet — Starý IS', () => {
  beforeEach(() => {
    openExternal.mockReset().mockResolvedValue(undefined);
    logError.mockReset();
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      recentSubjects: [],
      subjects: null,
      studyPlanDual: null,
      studiumId: '4321',
      userFaculty: null,
      userSemester: null,
      executeSearch: vi.fn().mockResolvedValue({ people: [], subjects: [] }),
    } as never);
  });

  const openPages = () => {
    render(<SearchSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Starý IS' }));
    return screen.getByRole('textbox');
  };
  const results = () => within(screen.getByTestId('student-results'));

  it('is the third segment; a bare open still starts on Lidé', () => {
    render(<SearchSheet onClose={() => {}} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Lidé',
      'Předměty',
      'Starý IS',
    ]);
    expect(screen.getByRole('tab', { name: 'Lidé' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Starý IS' })).toHaveAttribute('aria-selected', 'false');
  });

  it('a prefilled open still starts on Předměty', () => {
    render(<SearchSheet sheet={{ kind: 'search', query: 'ALG' }} onClose={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Předměty' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists the pages by IS category, five per category until expanded', () => {
    const input = openPages();
    expect(input).toHaveAttribute('placeholder', 'Hledej stránku v IS…');
    const mojeStudium = pagesData[0]!;
    expect(results().getByText(mojeStudium.label)).toBeInTheDocument();
    expect(results().getByText(mojeStudium.children[4]!.label)).toBeInTheDocument();
    expect(results().queryByText(mojeStudium.children[5]!.label)).not.toBeInTheDocument();

    const hidden = mojeStudium.children.length - 5;
    fireEvent.click(results().getAllByRole('button', { name: `Zobrazit dalších ${hidden}` })[0]!);
    expect(results().getByText(mojeStudium.children[5]!.label)).toBeInTheDocument();
    expect(results().getAllByRole('button', { name: 'Zobrazit méně' })).toHaveLength(1);
  });

  it('filters by the field, accent-insensitively, showing every match', () => {
    const input = openPages();
    fireEvent.change(input, { target: { value: 'zkousky' } });
    expect(results().getByText('Přihlašování na zkoušky')).toBeInTheDocument();
    expect(results().queryByText('E-index')).not.toBeInTheDocument();
    // Filtering never collapses: there is nothing to "show more" of.
    expect(results().queryByRole('button', { name: /Zobrazit/ })).not.toBeInTheDocument();
  });

  it('says so when no page matches', () => {
    const input = openPages();
    fireEvent.change(input, { target: { value: 'xyzzyq' } });
    expect(results().getByText('Nic jsme nenašli. Zkus to jinak.')).toBeInTheDocument();
  });

  it('opens a tapped page through openExternal with the student’s params injected', () => {
    openPages();
    fireEvent.mouseDown(results().getByText('E-index'));
    expect(openExternal).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/pruchod_studiem.pl?studium=4321;lang=cz'
    );
  });

  it('routes a demo-mode refusal through logError, which shows the demo toast', async () => {
    const refusal = new DemoModeError();
    openExternal.mockRejectedValue(refusal);
    openPages();
    fireEvent.mouseDown(results().getByText('E-index'));
    await vi.waitFor(() => expect(logError).toHaveBeenCalledWith(expect.any(String), refusal));
  });

  it('opens the page the arrow keys landed on when Return is pressed', () => {
    const input = openPages();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'mobile-search-option-0');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(openExternal).toHaveBeenCalledWith(PORTAL_STUDENTA);
  });

  it('walks only the VISIBLE rows: ArrowUp from nothing lands on the last shown page', () => {
    const input = openPages();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const lastCategory = pagesData[pagesData.length - 1]!;
    const lastShown = lastCategory.children.slice(0, 5).at(-1)!;
    const active = document.getElementById(input.getAttribute('aria-activedescendant')!);
    expect(active).toHaveTextContent(lastShown.label);
    expect(active).toHaveAttribute('aria-selected', 'true');
  });
});
