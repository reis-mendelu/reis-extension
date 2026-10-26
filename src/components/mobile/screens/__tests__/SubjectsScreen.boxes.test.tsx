import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { StudyPlan } from '../../../../types/studyPlan';
import { NOW, box } from '../../../SubmissionBoxes/__tests__/boxFixtures';

const plan = {
  title: 'Plán',
  isFulfilled: false,
  creditsAcquired: 10,
  creditsRequired: 180,
  blocks: [
    {
      title: '3. semestr',
      groups: [
        {
          name: 'Povinné',
          statusDescription: '',
          subjects: [
            {
              id: 'P1',
              code: 'EBC-PJ',
              name: 'Java',
              credits: 6,
              type: 'zk',
              isEnrolled: true,
              isFulfilled: false,
              enrollmentCount: 1,
              rawStatusText: '',
            },
          ],
        },
      ],
    },
  ],
} as unknown as StudyPlan;

/** Kuba's case: a box he could no longer find. The phone now has a way back to it. */
describe('SubjectsScreen — odevzdávárny', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      mobileSheets: [],
      studyPlanDual: { cz: plan, en: plan },
      studyStats: null,
      studyComparison: null,
      firstSyncSettled: true,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      odevzdavarny: [box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' })],
      subjects: { data: { 'EBC-PJ': { subjectId: 'P1' } } },
    } as never);
  });

  it('opens the box’s subject on Záznamník', () => {
    render(<SubjectsScreen />);
    fireEvent.click(screen.getByText('Rozpracovaný projekt'));
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-PJ',
      courseId: 'P1',
      initialTab: 'zaznamnik',
    });
  });

  it('shows no card when nothing is open', () => {
    useAppStore.setState({ odevzdavarny: [] });
    render(<SubjectsScreen />);
    expect(screen.queryByTestId('submission-boxes-summary')).toBeNull();
  });
});
