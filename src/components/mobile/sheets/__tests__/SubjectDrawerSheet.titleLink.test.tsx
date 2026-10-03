import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));
// A known id would otherwise send the syllabus tab to IS for real.
vi.mock('../../../../hooks/data/useSyllabus', () => ({
  useSyllabus: () => ({ syllabus: null, isLoading: false }),
}));

const SYLLABUS = 'https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=159410;lang=cz';

/**
 * The subject's name links to its syllabus in IS, as the extension's drawer
 * title does. #341 took every other IS link out of this sheet; the title is the
 * one exception, approved by Dominik, so the "no IS link" test beside this one
 * is narrowed to "none but the title" rather than dropped.
 */
describe('SubjectDrawerSheet title link', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
      files: { ALG: [] },
      lastFilesFetchedAt: { ALG: Date.now() },
      schedule: { data: [], status: 'success' },
    } as never);
  });

  const renderSheet = (courseId?: string) =>
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace', courseId }}
        onClose={vi.fn()}
      />
    );

  it("links the name to the subject's syllabus when the sheet knows its id", () => {
    const { container } = renderSheet('159410');
    const link = screen.getByRole('link', { name: /Algoritmizace/ });
    expect(link).toHaveAttribute('href', SYLLABUS);
    expect(link).toHaveAttribute('target', '_blank');
    // The only IS link on the sheet: #341's trim holds everywhere else.
    expect(container.querySelectorAll('a[href*="is.mendelu.cz"]')).toHaveLength(1);
  });

  // A sheet opened from somewhere that only knows the code (search, a
  // notification) gets its id from the timetable, as the syllabus tab does.
  it('finds the id in the timetable when the sheet was opened without one', () => {
    useAppStore.setState({
      schedule: { data: [{ courseCode: 'ALG', courseId: '159410' }], status: 'success' },
    } as never);
    renderSheet();
    expect(screen.getByRole('link', { name: /Algoritmizace/ })).toHaveAttribute('href', SYLLABUS);
  });

  it('leaves the name as plain text when no id is known', () => {
    renderSheet();
    expect(screen.getByText('Algoritmizace').closest('a')).toBeNull();
  });

  it('follows the app language', () => {
    useAppStore.setState({ language: 'en' } as never);
    renderSheet('159410');
    expect(screen.getByRole('link', { name: /Algoritmizace/ })).toHaveAttribute(
      'href',
      SYLLABUS.replace('lang=cz', 'lang=en')
    );
  });
});
