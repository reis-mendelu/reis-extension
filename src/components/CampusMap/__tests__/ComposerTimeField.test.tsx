import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerTimeField } from '../ComposerTimeField';

const t = (k: string) => k;

// Controlled wrapper: the field is controlled, so a two-step (hour then minute)
// pick only works if the value round-trips back in — same as EventComposer does.
function Harness({ onChange, initial = '' }: { onChange?: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <ComposerTimeField
      value={v}
      onChange={(x) => {
        setV(x);
        onChange?.(x);
      }}
      t={t}
    />
  );
}

const openPopover = () => fireEvent.click(screen.getByRole('button', { name: 'map.eventTime' }));

describe('ComposerTimeField', () => {
  it('picking an hour then a minute yields HH:MM', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: '19' })); // 19 is hour-only
    fireEvent.click(screen.getByRole('button', { name: '30' })); // 30 is minute-only
    expect(onChange).toHaveBeenLastCalledWith('19:30');
  });

  it('picking an hour alone defaults the minute to 00', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: '21' }));
    expect(onChange).toHaveBeenLastCalledWith('21:00');
  });

  it('offers minutes in 5-minute steps only', () => {
    render(<Harness initial="00:00" />);
    openPopover();
    expect(screen.getByRole('button', { name: '55' })).toBeInTheDocument(); // minute-only
    // "37" is neither a 5-minute step nor a valid hour (max 23), so it must not
    // appear as any button.
    expect(screen.queryByRole('button', { name: '37' })).toBeNull();
  });

  it('clears the time back to empty (time is optional)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="19:30" />);
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'map.clearTime' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('renders no native <select> (avoids the OS double border)', () => {
    const { container } = render(<Harness initial="18:00" />);
    expect(container.querySelector('select')).toBeNull();
  });
});
