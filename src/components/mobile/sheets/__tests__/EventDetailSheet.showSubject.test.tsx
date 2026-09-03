import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetailSheet } from '../EventDetailSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';

/**
 * Tapping a lesson leads to the subject, not to hiding it.
 *
 * The sheet's secondary action was "Skrýt tuto hodinu" — the one thing almost
 * nobody wants from a lesson they just tapped, sitting where the obvious next
 * step belongs. "Instead of 'skryt tuto hodinu' on the calendarEvent, there
 * should be 'Ukázat předmět' or similar to open the subject."
 *
 * It pushes the same `subjectDrawer` the subjects screen and the search sheet
 * push, so the syllabus, files, difficulty and classmates all arrive with it.
 */
describe('EventDetailSheet — opening the subject', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      hiddenItems: { events: [], courses: [] },
      schedule: { data: [lesson({ id: 'l1' })], status: 'success' },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('offers to open the subject', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'l1' }} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ukázat předmět' })).toBeInTheDocument();
  });

  it('no longer offers to hide the lesson', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'l1' }} onClose={() => {}} />);
    expect(screen.queryByText('Skrýt tuto hodinu')).not.toBeInTheDocument();
  });

  it('pushes the subject drawer for that lesson, keeping the sheet beneath it', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'l1' }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ukázat předmět' }));
    const sheets = useAppStore.getState().mobileSheets;
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({ kind: 'subjectDrawer', courseCode: 'EBC-MAN' });
  });

  it('still offers the map', () => {
    render(<EventDetailSheet sheet={{ kind: 'eventDetail', eventId: 'l1' }} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ukázat na mapě' })).toBeInTheDocument();
  });
});
