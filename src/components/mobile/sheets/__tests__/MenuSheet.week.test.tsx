import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MenuSheet } from '../MenuSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { OutletMenu } from '../../../../types/menuTypes';

const MENU: OutletMenu[] = [
  {
    outlet: 'X',
    days: [
      { date: '12. 10. 2026', soup: null, mainDishes: ['Guláš'] },
      { date: '14. 10. 2026', soup: null, mainDishes: ['Rizoto'] },
    ],
  },
  { outlet: 'JAK', days: [{ date: '12. 10. 2026', soup: null, mainDishes: ['Svíčková'] }] },
];
const WEEK = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

const days = () => within(screen.getByRole('group', { name: 'Den' }));

/**
 * Opened from Týden's chef hat, the sheet carries the whole shown week: a row
 * of days above the canteens, one day's dishes at a time (design A, chosen
 * 10 October 2026 over a one-canteen week list).
 */
describe('MenuSheet over a week', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', menu: MENU } as never);
  });

  it('names the week and opens on the day it was given', () => {
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);
    expect(screen.getByText('12.–16. října')).toBeInTheDocument();
    expect(days().getByRole('button', { name: /Po\s*12/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Guláš')).toBeInTheDocument();
  });

  it('switches day in place', () => {
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);
    fireEvent.click(days().getByRole('button', { name: /St\s*14/ }));
    expect(screen.getByText('Rizoto')).toBeInTheDocument();
    // Monday stays in the layout to hold the height, hidden from sight and AT.
    expect(screen.getByText('Guláš').closest('[data-testid="menu-dishes"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  // A day with no menu is shown — the week keeps its shape — but cannot be
  // picked, so the sheet never lands on "Menu není k dispozici".
  it('shows a day that serves nothing, disabled', () => {
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);
    expect(days().getByRole('button', { name: /Út\s*13/ })).toBeDisabled();
  });

  // Picking a day where only one canteen serves must not leave the canteen
  // index pointing past the end.
  it('keeps a valid canteen when the day has fewer of them', () => {
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'JAK' }));
    fireEvent.click(days().getByRole('button', { name: /St\s*14/ }));
    expect(screen.getByText('Rizoto')).toBeInTheDocument();
  });

  /**
   * "Clicking different days weirdly expands the drawer's height" — Dominik,
   * 10 October 2026. The sheet hugs its content, so its top edge jumped by up
   * to 130px at 390px as each day's list came and went. Every day×canteen list
   * now stays in the layout, stacked in one grid cell with only the picked one
   * visible, so the sheet is as tall as the week's longest list throughout.
   */
  it('keeps every list in the layout so switching does not change the height', () => {
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);
    const lists = screen.getAllByTestId('menu-dishes', { hidden: true } as never);
    // Mon: X and JAK; Wed: X.
    expect(lists).toHaveLength(3);
    const shown = lists.filter((l) => !l.className.includes('invisible'));
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveTextContent('Guláš');
    for (const l of lists) expect(l.className).toContain('row-start-1');
    fireEvent.click(days().getByRole('button', { name: /St\s*14/ }));
    expect(
      screen.getAllByTestId('menu-dishes').filter((l) => !l.className.includes('invisible'))
    ).toHaveLength(1);
    expect(
      screen.getByText('Rizoto').closest('[data-testid="menu-dishes"]')!.className
    ).not.toContain('invisible');
  });

  /**
   * The canteen is remembered by NAME, not by position (CodeRabbit on #530).
   * Monday serves X, KA, JAK and Wednesday only X and JAK: by position, KA's
   * slot on Wednesday is JAK — a canteen the student never picked.
   */
  it('keeps the picked canteen by name across days, else the first', () => {
    useAppStore.setState({
      menu: [
        {
          outlet: 'X',
          days: [
            { date: '12. 10. 2026', soup: null, mainDishes: ['Guláš'] },
            { date: '14. 10. 2026', soup: null, mainDishes: ['Rizoto'] },
          ],
        },
        { outlet: 'KA', days: [{ date: '12. 10. 2026', soup: null, mainDishes: ['Řízek'] }] },
        {
          outlet: 'JAK',
          days: [
            { date: '12. 10. 2026', soup: null, mainDishes: ['Svíčková'] },
            { date: '14. 10. 2026', soup: null, mainDishes: ['Knedlíky'] },
          ],
        },
      ],
    } as never);
    const shown = () =>
      screen.getAllByTestId('menu-dishes').find((l) => !l.className.includes('invisible'))!;
    render(<MenuSheet dayIso="2026-10-12" week={WEEK} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: 'KA' }));
    fireEvent.click(days().getByRole('button', { name: /St\s*14/ }));
    expect(shown()).toHaveTextContent('Rizoto');

    fireEvent.click(screen.getByRole('tab', { name: 'JAK' }));
    fireEvent.click(days().getByRole('button', { name: /Po\s*12/ }));
    expect(shown()).toHaveTextContent('Svíčková');
  });

  // From Den's card the sheet is one day, as before: no day row.
  it('has no day row when opened for a single day', () => {
    render(<MenuSheet dayIso="2026-10-12" onClose={() => {}} />);
    expect(screen.queryByRole('group', { name: 'Den' })).toBeNull();
  });
});
