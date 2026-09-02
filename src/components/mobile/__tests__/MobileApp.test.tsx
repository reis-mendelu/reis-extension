import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MobileApp } from '../MobileApp';
import { useAppStore } from '../../../store/useAppStore';

// The screens pull in the whole data layer; this test is about the gate.
vi.mock('../screens/CalendarScreen', () => ({ CalendarScreen: () => <div>calendar-screen</div> }));
vi.mock('../screens/ExamsScreen', () => ({ ExamsScreen: () => null }));
vi.mock('../screens/SubjectsScreen', () => ({ SubjectsScreen: () => null }));
vi.mock('../screens/MapScreen', () => ({ MapScreen: () => null }));
vi.mock('../screens/StudentScreen', () => ({ StudentScreen: () => null }));
vi.mock('../nav/BottomNav', () => ({ BottomNav: () => <nav>bottom-nav</nav> }));
vi.mock('../sheets/SheetHost', () => ({ SheetHost: () => null }));
vi.mock('../WelcomeScreen', () => ({ WelcomeScreen: () => <div>welcome-screen</div> }));

afterEach(() => {
  cleanup();
});

describe('MobileApp first-run gate', () => {
  it('shows the welcome instead of the tabs on first run', () => {
    useAppStore.setState({ welcomeSeen: false, mobileTab: 'calendar', demoMode: false } as never);
    render(<MobileApp />);
    expect(screen.getByText('welcome-screen')).toBeInTheDocument();
    expect(screen.queryByText('bottom-nav')).not.toBeInTheDocument();
    expect(screen.queryByText('calendar-screen')).not.toBeInTheDocument();
  });

  it.each([null, true])('renders the tabs when welcomeSeen is %s', (welcomeSeen) => {
    // null = never hydrated (the extension's phone layout, the dev webapp):
    // a returning student must not see the welcome flash over the app.
    useAppStore.setState({ welcomeSeen, mobileTab: 'calendar', demoMode: false } as never);
    render(<MobileApp />);
    expect(screen.getByText('calendar-screen')).toBeInTheDocument();
    expect(screen.getByText('bottom-nav')).toBeInTheDocument();
    expect(screen.queryByText('welcome-screen')).not.toBeInTheDocument();
  });
});
