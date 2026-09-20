import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'cs' }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';

const notEnrolled: SubjectStatus = {
  id: '',
  code: 'EBC-ZUI',
  name: 'Základy umělé inteligence',
  credits: 5,
  type: 'P',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
};

const seedRate = (predmetId?: string) =>
  useAppStore.setState({
    successRates:
      predmetId === undefined
        ? {}
        : { 'EBC-ZUI': { courseCode: 'EBC-ZUI', stats: [], lastUpdated: '', predmetId } },
  });

describe('SubjectRow predmet-id direct-open', () => {
  // Typed from SubjectRow's own props: vitest 5's bare mock type is no longer
  // assignable to a concrete signature, and this keeps the two in step.
  let onOpenSubject: Mock<NonNullable<ComponentProps<typeof SubjectRow>['onOpenSubject']>>;
  let onSearchSubject: Mock<NonNullable<ComponentProps<typeof SubjectRow>['onSearchSubject']>>;
  beforeEach(() => {
    onOpenSubject = vi.fn();
    onSearchSubject = vi.fn();
  });

  const renderRow = () =>
    render(
      <SubjectRow
        subject={notEnrolled}
        onOpenSubject={onOpenSubject}
        onSearchSubject={onSearchSubject}
      />
    );

  it('opens the drawer directly when a valid predmetId resolves from success data', async () => {
    seedRate('160301');
    renderRow();
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenSubject).toHaveBeenCalledWith(
      'EBC-ZUI',
      'Základy umělé inteligence',
      '160301',
      undefined,
      undefined,
      false
    );
    expect(onSearchSubject).not.toHaveBeenCalled();
  });

  it('falls back to search when the predmetId is junk', async () => {
    seedRate('7');
    renderRow();
    await userEvent.click(screen.getByRole('button'));
    expect(onSearchSubject).toHaveBeenCalledWith('Základy umělé inteligence');
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('falls back to search when there is no success data', async () => {
    seedRate(undefined);
    renderRow();
    await userEvent.click(screen.getByRole('button'));
    expect(onSearchSubject).toHaveBeenCalledWith('Základy umělé inteligence');
    expect(onOpenSubject).not.toHaveBeenCalled();
  });
});
