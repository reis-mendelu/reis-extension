import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerRoomSearch } from '../ComposerRoomSearch';

const t = (k: string) => k;

describe('ComposerRoomSearch', () => {
  it('filters rooms by name and resolves a coord on select', () => {
    const onSelect = vi.fn();
    render(<ComposerRoomSearch selected={null} onSelect={onSelect} onClear={() => {}} t={t} />);
    fireEvent.change(screen.getByPlaceholderText('map.searchRoom'), { target: { value: 'Q6.06' } });
    const hit = screen.getByText('Q6.06');
    fireEvent.click(hit);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0];
    expect(arg.name).toBe('Q6.06');
    expect(Array.isArray(arg.coord)).toBe(true);
    expect(arg.coord).toHaveLength(2); // [lng, lat]
  });

  it('shows the selected room with a change button', () => {
    const onClear = vi.fn();
    render(<ComposerRoomSearch selected={{ code: 'X', name: 'Q6.06' }} onSelect={() => {}} onClear={onClear} t={t} />);
    expect(screen.getByText(/Q6\.06/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'map.changePlace' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
