import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutSection } from '../AboutSection';
import { useAppStore } from '../../../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../../../data/societies';

describe('AboutSection', () => {
  beforeEach(() => {
    // A PEF student: EY is PEF's partner (spec 2026-10-09).
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      societies: BUNDLED_SOCIETIES,
      userFaculty: 'PEF',
      userProgramme: null,
      isErasmus: false,
      impersonation: null,
    } as never);
  });

  it('names the partner of the student field', () => {
    render(<AboutSection />);
    // By accessible name, not text: the mark is an inline SVG, so this also
    // checks a screen reader announces it as "EY" rather than skipping it.
    expect(screen.getByRole('img', { name: 'EY' })).toBeInTheDocument();
  });

  it('shows nothing to a student whose field has no partner', () => {
    useAppStore.setState({ userFaculty: 'ZF' } as never);
    const { container } = render(<AboutSection />);
    expect(container.firstChild).toBeNull();
  });

  // The load-bearing sentence. reIS's whole promise is that nothing leaves the
  // device, so a company mark silently poses "what does EY get?". The closest
  // precedent found while researching this — Satchel, a school app — scrapped
  // advertising outright after data-sharing fears, not after complaints that
  // ads were annoying. The boundary is stated before anyone has to ask.
  it('states what the partners do not get', () => {
    render(<AboutSection />);
    expect(screen.getByText(/Nevidí žádná data z tvého ISu/)).toBeInTheDocument();
  });

  // A credit asks for nothing. The moment the mark links to a careers page it
  // is an ad, whatever it looks like.
  it('gives the partner no outbound link', () => {
    const { container } = render(<AboutSection />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
