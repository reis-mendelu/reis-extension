import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MenuSheet } from '../MenuSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { PIZZERIA } from '../../../../test/fixtures/menuPage';
import type { OutletMenu } from '../../../../types/menuTypes';

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

/**
 * The pizzeria in the phone/iPad Jídelníček (student suggestion #39): one more
 * tab after the canteens, with its opening hours first and the pizzas under
 * them. The desktop popover has the same tab: MenuPopoverContent.pizzeria.test.
 */
describe('MenuSheet — the pizzeria', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      pizzeria: PIZZERIA,
      userFaculty: 'PEF',
      venuePins: [],
    } as never);
  });

  it('is the last tab', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    expect(tabs()).toEqual(['X', 'JAK', 'KA', 'Pizza']);
  });

  it('is no tab before the page has a pizzeria', () => {
    useAppStore.setState({ pizzeria: null } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    expect(tabs()).toEqual(['X', 'JAK', 'KA']);
  });

  it('shows the opening hours and the address', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pizza' }));
    const panel = screen.getByTestId('menu-pizzeria');
    expect(within(panel).getByText('Otevírací doba')).toBeInTheDocument();
    expect(
      within(panel).getByText(line('Po-Čt 8:00 - 15:00 výdej pizzy 10:30 - 14:30'))
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(line('Pá 8:00 - 13:00 výdej pizzy 10:30 - 13:00'))
    ).toBeInTheDocument();
    expect(within(panel).getByText('Zemědělská 1, Brno')).toBeInTheDocument();
  });

  it('lists each pizza with the student price, hours before pizzas', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pizza' }));
    const panel = screen.getByTestId('menu-pizzeria');
    expect(within(panel).getByText('01. Pizza pollo')).toBeInTheDocument();
    expect(within(panel).getByText('86 Kč')).toBeInTheDocument();
    expect(within(panel).getByText('99 Kč')).toBeInTheDocument();
    const hours = within(panel).getByText('Otevírací doba');
    const first = within(panel).getByText('01. Pizza pollo');
    expect(hours.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says so in English', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pizza' }));
    expect(
      within(screen.getByTestId('menu-pizzeria')).getByText('Opening hours')
    ).toBeInTheDocument();
  });

  it('the scrolling pizza list can be focused, so a keyboard reaches every pizza', () => {
    render(<MenuSheet dayIso={DAY} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pizza' }));
    const list = screen.getByRole('list', { name: 'Nabídka pizzerie' });
    expect(list).toHaveAttribute('tabindex', '0');
  });
});
