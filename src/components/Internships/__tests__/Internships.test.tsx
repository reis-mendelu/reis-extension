import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { HeaderActions } from '../../mobile/screens/HeaderActions';
import { InternshipsSheet } from '../../mobile/sheets/InternshipsSheet';
import { InternshipsMenu } from '../InternshipsMenu';

// Stáže, next to the vývěska on both trees. Shown only to a student whose
// field has a partner (EY is PEF's), decided on the device like PartnersBlock.
describe('Stáže', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu',
      societies: { ...BUNDLED_SOCIETIES },
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
      isErasmus: false,
      impersonation: null,
      mobileSheets: [],
      notifications: {
        data: [],
        status: 'success',
        readIds: new Set<string>(),
        viewedIds: new Set<string>(),
        seenDeadlineAlertIds: new Set<string>(),
      },
      exams: { data: [] },
      odevzdavarny: [],
      cvicneTests: [],
      now: new Date(),
    } as never);
  });

  describe('phone header', () => {
    it('opens the Stáže sheet for a student whose field has a partner', () => {
      render(<HeaderActions />);
      fireEvent.click(screen.getByRole('button', { name: 'Stáže' }));
      expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({ kind: 'internships' });
    });

    it('has no Stáže button when no partner matches the field', () => {
      useAppStore.setState({ userFaculty: 'ZF', userProgramme: null } as never);
      render(<HeaderActions />);
      expect(screen.queryByRole('button', { name: 'Stáže' })).toBeNull();
    });
  });

  it('lists the partner programme with a link that leaves the app', () => {
    render(<InternshipsSheet onClose={() => {}} />);
    const link = screen.getByRole('link', { name: /Cesta s EY/ });
    expect(link).toHaveAttribute('href', 'https://cestasey.cz/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('img', { name: 'EY' })).toBeInTheDocument();
    // The card says what it is; an intro line above it was redundant (Task List).
    expect(screen.queryByText(/se kterými spolupracujeme/)).toBeNull();
  });

  describe('extension header', () => {
    it('opens the same list from a button next to the vývěska', () => {
      render(<InternshipsMenu />);
      expect(screen.queryByRole('link', { name: /Cesta s EY/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Stáže' }));
      expect(screen.getByRole('link', { name: /Cesta s EY/ })).toHaveAttribute(
        'href',
        'https://cestasey.cz/'
      );
      expect(screen.queryByText(/se kterými spolupracujeme/)).toBeNull();
    });

    it('hands keyboard focus back to the pill when the dropdown closes', () => {
      render(<InternshipsMenu />);
      const pill = screen.getByRole('button', { name: 'Stáže' });
      fireEvent.click(pill);
      const close = screen.getByRole('button', { name: 'Zavřít stáže' });
      close.focus();
      fireEvent.click(close);
      expect(document.activeElement).toBe(pill);

      fireEvent.click(pill);
      screen.getByRole('link', { name: /Cesta s EY/ }).focus();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('link', { name: /Cesta s EY/ })).toBeNull();
      expect(document.activeElement).toBe(pill);
    });

    it('closes for good when the field stops matching while it is open', () => {
      render(<InternshipsMenu />);
      fireEvent.click(screen.getByRole('button', { name: 'Stáže' }));
      act(() => useAppStore.setState({ userFaculty: 'ZF', userProgramme: null } as never));
      expect(screen.queryByRole('button', { name: 'Stáže' })).toBeNull();
      act(() => useAppStore.setState({ userFaculty: 'PEF', userProgramme: 'B-OI' } as never));
      expect(screen.getByRole('button', { name: 'Stáže' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    });

    // jsdom has no layout, so this pins the classes; the widths themselves
    // were measured in a browser (600/768/900/1024px, PR #651).
    it('spans the main column below 880px instead of hanging off the pill', () => {
      render(<InternshipsMenu />);
      fireEvent.click(screen.getByRole('button', { name: 'Stáže' }));
      const panel = screen
        .getByRole('link', { name: /Cesta s EY/ })
        .closest('[data-internships-panel]');
      expect(panel?.className).toContain('fixed inset-x-4');
      expect(panel?.className).toContain('min-[880px]:absolute');
    });

    it('renders nothing when no partner matches the field', () => {
      useAppStore.setState({ userFaculty: 'ZF', userProgramme: null } as never);
      const { container } = render(<InternshipsMenu />);
      expect(container.firstChild).toBeNull();
    });
  });
});
