import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Wifi } from 'lucide-react';
import { NavRow } from '../NavRow';

/**
 * The row that says "this opens a page".
 *
 * Its chevron is not decoration: it is the only thing on a phone row that
 * distinguishes navigating INTO something from expanding it in place, and the
 * study plan became one of these when it stopped being a dropdown.
 */
describe('NavRow', () => {
  it('reads as one control with the label as its name', () => {
    render(<NavRow icon={Wifi} label="eduroam" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /eduroam/ })).toBeInTheDocument();
  });

  it('carries the chevron that promises a destination', () => {
    render(<NavRow icon={Wifi} label="eduroam" onClick={() => {}} />);
    // lucide renders an svg; the row must contain exactly the two it declares
    // (the leading icon and the trailing chevron) — a row with no chevron reads
    // as an accordion header.
    expect(screen.getByRole('button').querySelectorAll('svg')).toHaveLength(2);
  });

  it('shows a sublabel when given one, and no empty line when not', () => {
    const { rerender } = render(
      <NavRow
        icon={Wifi}
        label="eduroam"
        sublabel="Nastavit na tomto zařízení"
        onClick={() => {}}
      />
    );
    expect(screen.getByText('Nastavit na tomto zařízení')).toBeInTheDocument();
    rerender(<NavRow icon={Wifi} label="eduroam" onClick={() => {}} />);
    // One line, not a label above a blank strip.
    expect(screen.getByRole('button').querySelectorAll('span')).toHaveLength(1);
  });

  it('navigates when tapped', () => {
    const onClick = vi.fn();
    render(<NavRow icon={Wifi} label="eduroam" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
