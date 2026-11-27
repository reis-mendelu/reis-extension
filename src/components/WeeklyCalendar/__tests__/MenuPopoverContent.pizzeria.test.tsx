import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MenuPopoverContent } from '../MenuPopoverContent';
import { useAppStore } from '../../../store/useAppStore';
import { PIZZERIA } from '../../../test/fixtures/menuPage';
import type { OutletMenu } from '../../../types/menuTypes';

const DAY = '2026-11-09'; // a Monday
const MENU: OutletMenu[] = ['X', 'KA', 'JAK'].map((outlet) => ({
  outlet,
  days: [{ date: '9. 11. 2026', soup: null, mainDishes: [`Jídlo ${outlet}`] }],
}));

/** A whole hours row: the time ranges are their own spans, so match the row's text. */
const line = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'LI' && el.textContent === text;

const tabs = () =>
  within(screen.getByRole('group', { name: 'Výdejna' }))
    .getAllByRole('button')
    .map((b) => b.textContent);

/** The extension's half of student suggestion #39: the same tab as the phone's sheet. */
describe('MenuPopoverContent — the pizzeria', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      pizzeria: PIZZERIA,
      menuLoading: false,
      menuError: false,
      userFaculty: 'PEF',
      venuePins: [],
    } as never);
  });

  it('is the last tab', () => {
    render(<MenuPopoverContent dayIso={DAY} onClose={vi.fn()} />);
    expect(tabs()).toEqual(['X', 'JAK', 'KA', 'Pizza']);
  });

  it('shows the hours and the pizzas with student prices', () => {
    render(<MenuPopoverContent dayIso={DAY} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pizza' }));
    const panel = screen.getByTestId('menu-pizzeria');
    expect(
      within(panel).getByText(line('Po-Čt 8:00 - 15:00 výdej pizzy 10:30 - 14:30'))
    ).toBeInTheDocument();
    expect(within(panel).getByText('02. Pizza americana')).toBeInTheDocument();
    expect(within(panel).getByText('80 Kč')).toBeInTheDocument();
  });

  it('no Pizza tab on a day no canteen serves', () => {
    render(<MenuPopoverContent dayIso="2026-11-14" onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pizza' })).toBeNull();
  });
});
