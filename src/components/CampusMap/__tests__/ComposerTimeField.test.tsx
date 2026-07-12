import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerTimeField } from '../ComposerTimeField';

const t = (k: string) => k;

describe('ComposerTimeField', () => {
  it('picking an hour fills the minute with 00', () => {
    const onChange = vi.fn();
    render(<ComposerTimeField value="" onChange={onChange} t={t} />);
    fireEvent.change(screen.getByLabelText('map.hour'), { target: { value: '19' } });
    expect(onChange).toHaveBeenLastCalledWith('19:00');
  });

  it('combines the existing hour with a chosen minute', () => {
    const onChange = vi.fn();
    render(<ComposerTimeField value="19:00" onChange={onChange} t={t} />);
    fireEvent.change(screen.getByLabelText('map.minute'), { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith('19:30');
  });

  it('clearing the hour back to -- empties the value (time is optional)', () => {
    const onChange = vi.fn();
    render(<ComposerTimeField value="19:30" onChange={onChange} t={t} />);
    fireEvent.change(screen.getByLabelText('map.hour'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('offers minutes in 5-minute steps', () => {
    render(<ComposerTimeField value="" onChange={() => {}} t={t} />);
    const minute = screen.getByLabelText('map.minute') as HTMLSelectElement;
    const opts = Array.from(minute.options).map((o) => o.value);
    expect(opts).toContain('05');
    expect(opts).toContain('55');
    expect(opts).not.toContain('01');
  });
});
