import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { BlockLesson } from '../../../../types/calendarTypes';

vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));
vi.mock('../../../../hooks/data/useSyllabus', () => ({
  useSyllabus: () => ({ syllabus: null, isLoading: false }),
}));

const lesson = (room: string) =>
  ({
    id: 'alg-1',
    date: '20261030',
    startTime: '10:00',
    endTime: '11:50',
    courseCode: 'ALG',
    courseName: 'Algoritmizace',
    room,
    roomStructured: { name: room, id: '' },
    teachers: [],
    isSeminar: 'true',
  }) as unknown as BlockLesson;

/**
 * Spec 2026-10-30, decision 6: a subject opened from a Týden block says where
 * and when THAT lesson is, with Trasa — the block itself had no room for a
 * map pin. Opened from Den or Předměty it says nothing of the kind: Den's row
 * already showed the room, and Předměty has no lesson.
 */
describe('SubjectDrawerSheet — the lesson a Týden block was', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'calendar',
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

  const renderSheet = (weekLesson?: BlockLesson) =>
    render(
      <SubjectDrawerSheet
        sheet={{
          kind: 'subjectDrawer',
          courseCode: 'ALG',
          courseName: 'Algoritmizace',
          weekLesson,
        }}
        onClose={vi.fn()}
      />
    );

  it('says where and when the lesson is, and routes to it', () => {
    renderSheet(lesson('Q01'));
    const row = screen.getByTestId('week-lesson-place');
    expect(within(row).getByText(/Q01/)).toBeTruthy();
    expect(within(row).getByText(/10:00–11:50/)).toBeTruthy();
    expect(within(row).getByText(/30\. října/)).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Trasa →' }));
    expect(useAppStore.getState().mobileTab).toBe('map');
  });

  it('offers no Trasa for a room the map cannot walk to', () => {
    renderSheet(lesson('ZZ999'));
    const row = screen.getByTestId('week-lesson-place');
    expect(within(row).getByText(/ZZ999/)).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Trasa →' })).toBeNull();
  });

  it('is not there when the sheet was not opened from Týden', () => {
    renderSheet();
    expect(screen.queryByTestId('week-lesson-place')).toBeNull();
  });
});
