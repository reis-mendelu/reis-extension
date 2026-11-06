import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useLongPress } from '../useLongPress';

function Probe({ onLong, onClick }: { onLong: () => void; onClick?: () => void }) {
  return (
    <>
      <div data-testid="t" onClick={onClick} {...useLongPress(onLong)} />
      <div data-testid="elsewhere" />
    </>
  );
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

  // A Týden block opens its subject on a tap and its hide menu on a hold. The
  // finger lifting after a hold is a click too, and must not open the subject
  // over the menu (2026-11-06).
  it('swallows the click that ends a hold, and only that one', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { getByTestId } = render(<Probe onLong={vi.fn()} onClick={onClick} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    act(() => void vi.advanceTimersByTime(700));
    fireEvent.pointerUp(getByTestId('t'));
    fireEvent.click(getByTestId('t'));
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(getByTestId('t'));
    fireEvent.click(getByTestId('t'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a tap is still a click', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<Probe onLong={vi.fn()} onClick={onClick} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(getByTestId('t'));
    fireEvent.click(getByTestId('t'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // Two fingers held still before a spread are a pinch, not a hold — wherever
  // the second one lands.
  it('a second finger anywhere cancels it', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(getByTestId('elsewhere'), { pointerId: 2, clientX: 50, clientY: 0 });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });

  it('a second touch cancels it even where no pointer event says so', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { getByTestId } = render(<Probe onLong={onLong} />);
    fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0 });
    fireEvent.touchStart(getByTestId('elsewhere'), {
      touches: [
        { identifier: 1, clientX: 0, clientY: 0 },
        { identifier: 2, clientX: 50, clientY: 0 },
      ],
    });
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLong).not.toHaveBeenCalled();
  });
});
