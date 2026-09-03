import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudyPlanSheet } from '../StudyPlanSheet';
import { StudyPlanPage } from '../../../SubjectsPanel/StudyPlanPage';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * No second search box inside the study plan, on the phone.
 *
 * `StudyPlanPage` is the DESKTOP component, hosted whole inside the phone's
 * sheet, and it brings its own `SearchBar`. On the desktop that is the only
 * search on the page and it stays. On the phone there is now a search icon in
 * the header on every tab, so the one inside the plan is a second, narrower
 * search competing for the same job — and on an iPad it summons a keyboard
 * that covers the plan the student opened it to read.
 *
 * Hidden rather than deleted: the desktop keeps it, which is why this is a
 * prop and not a removal.
 */
describe('StudyPlanSheet search', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      studyPlanDual: null,
      successRates: {},
      gradeHistory: null,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('offers no subject search inside the sheet', () => {
    render(<StudyPlanSheet onClose={() => {}} />);
    expect(screen.queryByPlaceholderText(/Hledej předměty/i)).not.toBeInTheDocument();
  });

  it('still offers it on the desktop page, which has no header search', () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.getByPlaceholderText(/Hledej předměty/i)).toBeInTheDocument();
  });
});
