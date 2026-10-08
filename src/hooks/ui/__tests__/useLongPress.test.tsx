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

  it('a release cancels it', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(getByTestId('t'));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it('a move past the slop cancels it', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(getByTestId('t'), { clientX: 30, clientY: 0 });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it('blocks the context menu after a touch hold, not after a mouse press', () => {
    const { getByTestId } = render(<Probe onLong={vi.fn()} />);
    fireEvent.pointerDown(getByTestId('t'), { pointerType: 'mouse', clientX: 0, clientY: 0 });
    expect(fireEvent.contextMenu(getByTestId('t'))).toBe(true);
    fireEvent.pointerDown(getByTestId('t'), { pointerType: 'touch', clientX: 0, clientY: 0 });
    expect(fireEvent.contextMenu(getByTestId('t'))).toBe(false);
  });
});
