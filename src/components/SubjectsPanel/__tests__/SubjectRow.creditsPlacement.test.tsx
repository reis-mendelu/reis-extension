import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';

const subject: SubjectStatus = {
  id: '',
  code: 'EBC-ALG',
  name: 'Angličtina 1',
  credits: 6,
  type: 'Zk',
  isEnrolled: true,
  isFulfilled: false,
  fulfillmentDate: '',
  enrollmentCount: 1,
  rawStatusText: 'ZAPSÁNO',
};

const noop = () => {};

/**
 * #401 put the credits back on the phone, at the end of the row. At 320px that
 * cost every name 33px and clipped seven more of them — "Management",
 * "Počítačové sítě" — so on a phone they go on a second line under the name,
 * and keep their own column from `md` up. jsdom does not evaluate `md:`, so
 * this pins the classes rather than the pixels: exactly one copy may render
 * below `md`, and it is the one under the name.
 */
describe('SubjectRow credits placement', () => {
  beforeEach(() => {
    useAppStore.setState({
      gradeHistory: { grades: [] },
      successRates: {},
      language: 'cz',
    } as never);
  });

  it.each([false, true])('puts the phone copy under the name (compact=%s)', (compact) => {
    render(
      <SubjectRow subject={subject} compact={compact} onOpenSubject={noop} onSearchSubject={noop} />
    );
    const phoneCopies = screen
      .getAllByText('6 kr.')
      .filter((el) => !el.className.split(/\s+/).includes('hidden'));
    expect(phoneCopies).toHaveLength(1);
    expect(phoneCopies[0]?.className).toContain('md:hidden');
    expect(phoneCopies[0]?.previousElementSibling?.textContent).toBe('Angličtina 1');
  });

  it('abbreviates the unit in the student’s language', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<SubjectRow subject={subject} onOpenSubject={noop} onSearchSubject={noop} />);
    expect(screen.getAllByText('6 cr.').length).toBeGreaterThan(0);
  });

  it('shows nothing for the 999 sentinel', () => {
    render(
      <SubjectRow
        subject={{ ...subject, credits: 999 }}
        onOpenSubject={noop}
        onSearchSubject={noop}
      />
    );
    expect(screen.queryByText(/^999/)).not.toBeInTheDocument();
  });
});
