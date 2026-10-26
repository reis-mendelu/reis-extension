import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GradingTable } from '../../SubjectFileDrawer/Syllabus/GradingTable';
import { PhArchView } from '../../SubjectFileDrawer/Zaznamnik/PhArchView';
import { SemesterSelector } from '../../SuccessRate/SemesterSelector';
import { useAppStore } from '../../../store/useAppStore';
import type { PhSection } from '../../../types/zaznamnik';

/** Make the first sideways scroller overflow and let its buttons re-measure. */
function overflow(container: HTMLElement) {
  const el = container.querySelector('.overflow-x-auto') as HTMLElement;
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 300 });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 700 });
  const scrollBy = vi.fn();
  el.scrollBy = scrollBy as never;
  act(() => {
    fireEvent.scroll(el);
  });
  return scrollBy;
}

/**
 * The grading table and a záznamník arch scroll sideways when they are wider
 * than the drawer. In the iPad app on a Mac their scrollbar is an overlay a
 * pointer cannot grab (and `custom-scrollbar` styling does not apply), so a
 * mouse had no way to the columns on the right. Both now carry the edge
 * buttons (HorizontalScroller → EdgeScrollButtons) without a touch pointer.
 */
describe('sideways tables and a mouse', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', isTouch: false } as never));

  it('GradingTable: a forward button while it overflows', () => {
    const { container } = render(
      <GradingTable
        table={[
          ['Hodnocení', 'Prezenční', 'Kombinovaná'],
          ['Zkouška', '60 %', '60 %'],
        ]}
        studyForm=""
      />
    );
    const scrollBy = overflow(container);
    fireEvent.click(screen.getByRole('button', { name: 'Posunout dál' }));
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it('PhArchView: a forward button on an arch that overflows', () => {
    const sections = [
      {
        name: 'Průběžné hodnocení',
        arches: [
          {
            name: 'Testy',
            empty: false,
            columns: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'],
            values: ['5', '6', '7', '8', '9', '10', '4', '3'],
          },
        ],
      },
    ] as unknown as PhSection[];
    const { container } = render(<PhArchView sections={sections} />);
    const scrollBy = overflow(container);
    fireEvent.click(screen.getByRole('button', { name: 'Posunout dál' }));
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  // Below `sm` the semester chips are a sideways row too (a long history, a
  // narrow Mac window). Its top margin stays on the outermost box, which the
  // panel's flex column pushes to the bottom on desktop.
  it('SemesterSelector: a forward button while the chips overflow', () => {
    const stats = [2021, 2022, 2023, 2024, 2025].map((year) => ({
      year,
      semesterName: 'ZS',
      totalPass: 10,
      totalFail: 5,
    }));
    const { container } = render(
      <SemesterSelector stats={stats as never} activeIndex={0} onSelect={() => {}} />
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('sm:mt-auto');
    const scrollBy = overflow(container);
    fireEvent.click(screen.getByRole('button', { name: 'Posunout dál' }));
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });
});
