import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SocietyLogo } from '../SocietyLogo';
import { BUNDLED_SOCIETIES } from '../../data/societies';

const withLogo = { ...BUNDLED_SOCIETIES.supef!, logo: 'https://x.supabase.co/l.png' };

describe('SocietyLogo', () => {
  it('shows the glyph tile when there is no logo', () => {
    render(<SocietyLogo society={BUNDLED_SOCIETIES.supef!} className="h-6 w-6" />);
    expect(screen.getByText('SU')).toBeInTheDocument();
  });

  it('shows the logo when there is one', () => {
    const { container } = render(<SocietyLogo society={withLogo} className="h-6 w-6" />);
    expect(container.querySelector('img')).toHaveAttribute('src', withLogo.logo);
  });

  it('falls back to the glyph tile when the logo fails to load', () => {
    const { container } = render(<SocietyLogo society={withLogo} className="h-6 w-6" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('SU')).toBeInTheDocument();
  });

  it('picks readable glyph ink on a light brand colour', () => {
    render(<SocietyLogo society={BUNDLED_SOCIETIES.esn!} className="h-6 w-6" />);
    // ESN cyan fails with white (2.5:1), so the tile uses dark ink.
    expect(screen.getByText('ESN').parentElement).toHaveStyle({ color: '#111827' });
  });
});
