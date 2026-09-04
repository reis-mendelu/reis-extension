import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutSheet } from '../AboutSheet';
import { useAppStore } from '../../../../store/useAppStore';

describe('AboutSheet', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', theme: 'mendelu-dark' } as never);
  });

  it('says which build the student is running', () => {
    render(<AboutSheet onClose={vi.fn()} />);
    // getAppVersion falls back to 0.0.0 outside a build; the point is that a
    // version is shown at all — the app had no About surface and no way to
    // answer "which version am I on" when reporting a bug.
    expect(screen.getByTestId('about-version')).toHaveTextContent(/reIS \d+\.\d+\.\d+/);
  });

  it('names the partner and what they actually do', () => {
    render(<AboutSheet onClose={vi.fn()} />);
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
    render(<AboutSheet onClose={vi.fn()} />);
    expect(screen.getByText(/Nevidí žádná data z tvého ISu/)).toBeInTheDocument();
  });

  // A credit asks for nothing. The moment the mark links to a careers page it
  // is an ad, whatever it looks like. When there are real opportunities they
  // link to the opportunity, never to a corporate homepage.
  it('gives the partner no outbound link', () => {
    const { container } = render(<AboutSheet onClose={vi.fn()} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
