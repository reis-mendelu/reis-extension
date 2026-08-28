import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';

describe('SubjectsScreen first-sync loading', () => {
  // The study plan arrives in the same Phase 2 push as the schedule, so this
  // screen had the same gap: plan absent because it has not landed yet reads
  // identically to plan absent because the student has none.
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studyPlanDual: null as never,
      firstSyncSettled: false,
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });

  it('keeps the skeleton up while the first sync is still fetching', () => {
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Načítám předměty…')).toBeInTheDocument();
  });

  it('keeps the skeleton when the plan parsed to an empty husk mid-sync', () => {
    // KontrolaPlanu that fails to parse comes back as an object with no
    // subjects rather than null. Rendering the empty state for it while the
    // sync is still running says "you have no subjects" about data that has not
    // finished arriving — the Předměty tab showing nothing while the study-plan
    // sheet showed a spinner.
    useAppStore.setState({
      studyPlanDual: {
        cz: { title: '', isFulfilled: false, creditsAcquired: 0, creditsRequired: 0, blocks: [] },
        en: { title: '', isFulfilled: false, creditsAcquired: 0, creditsRequired: 0, blocks: [] },
      } as never,
    });
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
  });

  it('says the load failed when the sync itself errored', () => {
    useAppStore.setState({
      firstSyncSettled: true,
      studyPlanDual: null as never,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: 'boom',
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-error')).toBeInTheDocument();
  });

  it('waits for a usable plan rather than for the fetch to report back', () => {
    // The study plan's fetch is TTL-gated, so "nothing came back" is
    // ambiguous. Releasing on it told a student with a full timetable "Zatím
    // žádné předměty", which reads as a statement of fact.
    useAppStore.setState({ syncLoaded: { schedule: true, exams: true } });
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
  });

  it('drops the skeleton once that sync has finished', () => {
    useAppStore.setState({
      firstSyncSettled: true,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    render(<SubjectsScreen />);
    expect(screen.queryByTestId('subjects-skeleton')).not.toBeInTheDocument();
  });
});
