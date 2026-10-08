import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

function Probe({ onLong }: { onLong: () => void }) {
  return <div data-testid="t" {...useLongPress(onLong)} />;
}

describe('useLongPress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after 700 ms held', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(699));
    expect(onLong).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onLong).toHaveBeenCalledOnce();
  });

  it('a release or a move cancels it', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(getByTestId('t'));
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(getByTestId('t'), { clientX: 30, clientY: 0 });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });
});
