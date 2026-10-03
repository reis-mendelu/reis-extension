import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { StudyPlan } from '@/types/studyPlan';

vi.mock('../EnrolledNowSection', () => ({ EnrolledNowSection: () => <div /> }));
vi.mock('../useSubjectsData', () => ({
  useSubjectsData: () => ({
    zameraniLookup: new Map(),
    subjectSemesters: new Map(),
    subjectToZameranis: new Map(),
    zameraniProgress: new Map(),
    failRates: {},
    enrolledCredits: 0,
  }),
}));

import { SubjectsPanel } from '../index';
import { useAppStore } from '@/store/useAppStore';
import { NOW, box } from '../../SubmissionBoxes/__tests__/boxFixtures';

const plan = {
  title: 'Plán',
  isFulfilled: false,
  creditsAcquired: 10,
  creditsRequired: 180,
  blocks: [
    { title: '3', groups: [{ name: 'G', statusDescription: '', subjects: [{ code: 'EBC-PJ' }] }] },
  ],
} as unknown as StudyPlan;

/** The extension's half of the Subjects-screen card (phone: SubjectsScreen.boxes.test). */
describe('SubjectsPanel — odevzdávárny', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studyPlanDual: { cz: plan, en: plan },
      studyPlanLoaded: true,
      syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true, isSyncing: false },
      odevzdavarny: [box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' })],
    } as never);
  });

  it('opens the box’s subject in the drawer on Záznamník', () => {
    const onOpenSubject = vi.fn();
    render(
      <SubjectsPanel
        onOpenSubject={onOpenSubject}
        onSearchSubject={() => {}}
        onOpenStudyPlan={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Rozpracovaný projekt'));
    expect(onOpenSubject).toHaveBeenCalledWith(
      'EBC-PJ',
      'Programovací jazyk Java',
      'P1',
      undefined,
      'zaznamnik'
    );
  });
});
