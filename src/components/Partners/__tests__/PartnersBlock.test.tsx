import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { PartnersBlock } from '../PartnersBlock';

// "Spolupracujeme s firmami" on both trees (spec 2026-10-09): only the
// partners of THIS student's field, decided on the device.
const kpmg = {
  ...BUNDLED_SOCIETIES.ey!,
  id: 'kpmg',
  name: 'KPMG',
  shortName: 'KPMG',
  audience: ['frrms'],
  markLight: 'https://x/light.png',
  markDark: 'https://x/dark.png',
};

describe('PartnersBlock', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu',
      societies: { ...BUNDLED_SOCIETIES, kpmg },
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
      isErasmus: false,
      impersonation: null,
    } as never);
  });

  it('shows only the partners of the student field', () => {
    render(<PartnersBlock />);
    expect(screen.getByRole('img', { name: 'EY' })).toBeInTheDocument();
    expect(screen.queryByAltText('KPMG')).toBeNull();
    expect(screen.getByText(/Nevidí žádná data z tvého ISu/)).toBeInTheDocument();
  });

  it('renders nothing when no partner matches the field', () => {
    useAppStore.setState({ userFaculty: 'ZF', userProgramme: null } as never);
    const { container } = render(<PartnersBlock />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing before the faculty is known', () => {
    useAppStore.setState({ userFaculty: null } as never);
    const { container } = render(<PartnersBlock />);
    expect(container.firstChild).toBeNull();
  });

  it('takes the light mark, and the dark one in dark mode', () => {
    useAppStore.setState({ userFaculty: 'FRRMS' } as never);
    const { unmount } = render(<PartnersBlock />);
    expect(screen.getByAltText('KPMG').getAttribute('src')).toBe('https://x/light.png');
    unmount();
    useAppStore.setState({ theme: 'mendelu-dark' } as never);
    render(<PartnersBlock />);
    expect(screen.getByAltText('KPMG').getAttribute('src')).toBe('https://x/dark.png');
  });

  it('falls back to the light mark in dark mode when there is no dark one', () => {
    useAppStore.setState({
      userFaculty: 'FRRMS',
      theme: 'mendelu-dark',
      societies: { ...BUNDLED_SOCIETIES, kpmg: { ...kpmg, markDark: undefined } },
    } as never);
    render(<PartnersBlock />);
    expect(screen.getByAltText('KPMG').getAttribute('src')).toBe('https://x/light.png');
  });

  // A credit asks for nothing: the moment a mark links somewhere it is an ad.
  it('gives no partner an outbound link', () => {
    const { container } = render(<PartnersBlock />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
