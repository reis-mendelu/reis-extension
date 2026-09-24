import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { toast } from 'sonner';
import { Toaster } from './sonner';

/*
 * Device report, Pixel 9a: "the toast cannot be dismissed by swipe (covers the
 * exit button)". Sonner derives swipe directions from the position, so
 * `top-center` allowed only an upward flick — a sideways swipe, the one people
 * try, did nothing — and a tap did nothing either, while the toast sat over a
 * sheet's Zpět button for up to 10 s.
 */

beforeAll(() => {
  // Sonner captures the pointer in onPointerDown, before it records the start.
  Element.prototype.setPointerCapture ??= () => {};
});

afterEach(async () => {
  act(() => {
    toast.dismiss();
  });
  cleanup();
  await new Promise((r) => setTimeout(r, 250));
});

async function show(message: string, options?: Parameters<typeof toast>[1]) {
  render(<Toaster position="top-center" />);
  act(() => {
    toast(message, options);
  });
  await screen.findByText(message);
  return screen.getByText(message).closest('[data-sonner-toast]') as HTMLElement;
}

/* The first move only locks the axis; the render it triggers is what reads the
   locked axis on the second move. */
function swipe(el: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
  fireEvent.pointerMove(el, {
    clientX: 100 + Math.sign(dx) * 2,
    clientY: 100 + Math.sign(dy) * 2,
    pointerId: 1,
  });
  fireEvent.pointerMove(el, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
}

const gone = (message: string) =>
  waitFor(() => expect(screen.queryByText(message)).not.toBeInTheDocument());

describe('Toaster dismissal', () => {
  it('dismisses on an upward swipe', async () => {
    swipe(await show('up'), 0, -100);
    await gone('up');
  });

  it.each([
    ['left', -120],
    ['right', 120],
  ])('dismisses on a %s swipe', async (_dir, dx) => {
    swipe(await show('sideways'), dx, 0);
    await gone('sideways');
  });

  it('dismisses on a tap', async () => {
    fireEvent.click(await show('tap'));
    await gone('tap');
  });

  it('a tap dismisses only the toast on screen, not the one queued behind it', async () => {
    render(<Toaster position="top-center" />);
    act(() => {
      toast('queued');
    });
    await screen.findByText('queued');
    act(() => {
      toast('front');
    });
    await screen.findByText('front');
    fireEvent.click(screen.getByText('front'));
    await gone('front');
    expect(screen.getByText('queued')).toBeInTheDocument();
  });

  it('a tap leaves a toast that never expires — only a deliberate swipe clears it', async () => {
    const el = await show('session', { duration: Infinity });
    fireEvent.click(el);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('session')).toBeInTheDocument();
    swipe(el, 120, 0);
    await gone('session');
  });
});
