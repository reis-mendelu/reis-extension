import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutSection } from '../AboutSection';
import { useAppStore } from '../../../../../store/useAppStore';

describe('AboutSection', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', theme: 'mendelu-dark' } as never);
  });

  it('names the partner and what they actually do', () => {
    render(<AboutSection />);
    // By accessible name, not text: the mark is an inline SVG, so this also
    // checks a screen reader announces it as "EY" rather than skipping it.
    expect(screen.getByRole('img', { name: 'EY' })).toBeInTheDocument();
    expect(screen.getByText('Díky nim reIS běží.')).toBeInTheDocument();
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
