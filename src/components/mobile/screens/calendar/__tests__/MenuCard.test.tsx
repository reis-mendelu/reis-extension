import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuCard } from '../MenuCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { OutletMenu } from '../../../../../types/menuTypes';

const MENU: OutletMenu[] = [
  {
    outlet: 'X',
    days: [{ date: '8. 9. 2026', soup: 'Kuřecí vývar', mainDishes: ['Svíčková', 'Rizoto'] }],
  },
  { outlet: 'JAK', days: [{ date: '8. 9. 2026', soup: null, mainDishes: ['Guláš'] }] },
];

const DAY = '2026-09-08';

describe('MenuCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      menu: MENU,
      menuLoading: false,
      menuError: false,
      mobileSheets: [],
      fetchMenu: vi.fn(),
    } as never);
  });

  // Leads with the first MAIN dish. Almost nobody at MENDELU eats the soup, so
  // summarising the day with it described it by the one line most students skip.
  it('summarises the day without making the student open anything', () => {
    render(<MenuCard dayIso={DAY} />);
    expect(screen.getByText('Svíčková')).toBeInTheDocument();
    expect(screen.queryByText('Kuřecí vývar')).not.toBeInTheDocument();
    // Two outlets serve that day, and the count is the reason to tap.
    expect(screen.getByTestId('menu-card')).toHaveTextContent('2');
  });

  it('opens the full menu sheet when tapped', () => {
    render(<MenuCard dayIso={DAY} />);
    fireEvent.click(screen.getByTestId('menu-card'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'menu', dayIso: DAY }]);
  });

  // The SKM page carries about two weeks. Beyond that there is nothing to say,
  // and a card that renders "nothing today" on every day of the holidays is
  // just a permanent empty box under the agenda.
  it('renders nothing for a day no outlet serves', () => {
    const { container } = render(<MenuCard dayIso="2026-09-20" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the menu has not loaded, and nothing if it failed', () => {
    useAppStore.setState({ menu: null, menuLoading: true } as never);
    const { container, rerender } = render(<MenuCard dayIso={DAY} />);
    expect(container).toBeEmptyDOMElement();

    useAppStore.setState({ menu: null, menuLoading: false, menuError: true } as never);
    rerender(<MenuCard dayIso={DAY} />);
    expect(container).toBeEmptyDOMElement();
  });

  // The Iron Rule: no useEffect for data fetching. `initializeStore` asks for
  // the menu at boot — on the phone too, since App.tsx runs useAppLogic() above
  // the shell branch — and both language handlers ask again. The card reads
  // `menu` synchronously and renders whatever is there.
  it('does not fetch: the store owns the request', () => {
    const fetchMenu = vi.fn();
    useAppStore.setState({ menu: null, menuLoading: false, menuError: false, fetchMenu } as never);
    render(<MenuCard dayIso={DAY} />);
    expect(fetchMenu).not.toHaveBeenCalled();
  });
});

describe('MenuCard fallback', () => {
  // An outlet serving only a soup is the one case where the soup is the answer.
  it('falls back to the soup when nothing else is on', () => {
    useAppStore.setState({
      language: 'cz',
      menu: [{ outlet: 'X', days: [{ date: '8. 9. 2026', soup: 'Česnečka', mainDishes: [] }] }],
      menuLoading: false,
      menuError: false,
      mobileSheets: [],
      fetchMenu: vi.fn(),
    } as never);
    render(<MenuCard dayIso={DAY} />);
    expect(screen.getByText('Česnečka')).toBeInTheDocument();
  });
});
