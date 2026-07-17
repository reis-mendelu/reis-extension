import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerTimeField } from '../ComposerTimeField';

const t = (k: string) => k;

// Controlled wrapper — the field is controlled, so the committed value must
// round-trip back in, same as EventComposer does.
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

const field = () => screen.getByRole('combobox', { name: 'map.eventTime' });

describe('ComposerTimeField', () => {
  it('typing digits commits a masked HH:MM', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(field(), { target: { value: '1930' } });
    expect(onChange).toHaveBeenLastCalledWith('19:30');
  });

  it('does not commit a partial time until it is complete', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(field(), { target: { value: '19' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: '1930' } });
    expect(onChange).toHaveBeenLastCalledWith('19:30');
  });

  it('reads a single-digit hour without a forced leading zero', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: '9' } });
    expect(field()).toHaveValue('09');
  });

  it('picks a time from the dropdown list', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(field());
    fireEvent.click(screen.getByRole('option', { name: '19:30' }));
    expect(onChange).toHaveBeenLastCalledWith('19:30');
  });

  it('offers the list in 15-minute steps only', () => {
    render(<Harness />);
    fireEvent.click(field());
    expect(screen.getByRole('option', { name: '19:30' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '19:35' })).toBeNull();
  });

  it('filters the list to the typed hour', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: '19' } });
    expect(screen.getByRole('option', { name: '19:00' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '18:00' })).toBeNull();
  });

  it('clears the time back to empty (time is optional)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="19:30" />);
    fireEvent.click(screen.getByRole('button', { name: 'map.clearTime' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('renders no native <select> (avoids the OS double border)', () => {
    const { container } = render(<Harness initial="18:00" />);
    expect(container.querySelector('select')).toBeNull();
  });
});
