import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyPlanSheet } from '../StudyPlanSheet';
import { useAppStore } from '../../../../store/useAppStore';

describe('StudyPlanSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      studyPlanDual: {
        cz: {
          title: 'Ekonomická informatika',
          isFulfilled: false,
          creditsAcquired: 96,
          creditsRequired: 180,
          blocks: [],
        },
        en: {
          title: 'Economic Informatics',
          isFulfilled: false,
          creditsAcquired: 96,
          creditsRequired: 180,
          blocks: [],
        },
      },
      successRates: {},
    } as never);
  });

  it('hosts StudyPlanPage and shows its title', () => {
    render(<StudyPlanSheet onClose={vi.fn()} />);
    expect(screen.getByText('Studijní plán')).toBeInTheDocument();
    expect(screen.getByTitle('Ekonomická informatika')).toBeInTheDocument();
  });

  it("closes the sheet when StudyPlanPage's back arrow is used", () => {
    const onClose = vi.fn();
    render(<StudyPlanSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the subject drawer sheet for a subject', () => {
    useAppStore.setState({
      studyPlanDual: {
        cz: {
          title: 'Ekonomická informatika',
          isFulfilled: false,
          creditsAcquired: 96,
          creditsRequired: 180,
          blocks: [
            {
              title: '1. semestr',
              groups: [
                {
                  name: 'Povinné',
                  statusDescription: '',
                  subjects: [
                    {
                      id: '159410',
                      code: 'ALG',
                      name: 'Algoritmizace',
                      credits: 6,
                      type: 'p',
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
        },
        en: {
          title: 'Economic Informatics',
          isFulfilled: false,
          creditsAcquired: 96,
          creditsRequired: 180,
          blocks: [],
        },
      },
    } as never);

    render(<StudyPlanSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('1. semestr')); // expand the (collapsed by default) semester
    fireEvent.click(screen.getByText('Algoritmizace'));

    expect(useAppStore.getState().mobileSheets).toEqual([
      { kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace', courseId: '159410' },
    ]);
  });
});
