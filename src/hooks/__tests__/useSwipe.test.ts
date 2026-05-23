import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useSwipe } from '../useSwipe';

function dispatchPointer(el: HTMLElement, type: string, x: number, y: number) {
    const ev = new Event(type, { bubbles: true }) as Event & { clientX: number; clientY: number };
    Object.defineProperty(ev, 'clientX', { value: x });
    Object.defineProperty(ev, 'clientY', { value: y });
    el.dispatchEvent(ev);
}

describe('useSwipe', () => {
    let el: HTMLElement;
    let onLeft: ReturnType<typeof vi.fn>;
    let onRight: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        el = document.createElement('div');
        document.body.appendChild(el);
        onLeft = vi.fn();
        onRight = vi.fn();
        renderHook(() => {
            const ref = useRef(el);
            useSwipe(ref, { onLeft, onRight });
        });
    });

    it('fires onLeft for a leftward swipe >50px', () => {
        dispatchPointer(el, 'pointerdown', 200, 100);
        dispatchPointer(el, 'pointerup', 100, 110);
        expect(onLeft).toHaveBeenCalledOnce();
        expect(onRight).not.toHaveBeenCalled();
    });

    it('fires onRight for a rightward swipe >50px', () => {
        dispatchPointer(el, 'pointerdown', 100, 100);
        dispatchPointer(el, 'pointerup', 200, 110);
        expect(onRight).toHaveBeenCalledOnce();
    });

    it('ignores swipes below the 50px distance threshold', () => {
        dispatchPointer(el, 'pointerdown', 100, 100);
        dispatchPointer(el, 'pointerup', 130, 100);
        expect(onLeft).not.toHaveBeenCalled();
        expect(onRight).not.toHaveBeenCalled();
    });

    it('ignores swipes with vertical angle > 30 degrees', () => {
        dispatchPointer(el, 'pointerdown', 100, 100);
        dispatchPointer(el, 'pointerup', 160, 200);
        expect(onLeft).not.toHaveBeenCalled();
        expect(onRight).not.toHaveBeenCalled();
    });

    it('survives parent re-render between pointerdown and pointerup (stable listener identity)', () => {
        // Regression: previously effect deps included onLeft/onRight, so inline
        // callbacks at call sites tore down the pointerdown closure mid-gesture.
        const target = document.createElement('div');
        document.body.appendChild(target);
        const firstLeft = vi.fn();
        const secondLeft = vi.fn();
        const { rerender } = renderHook(({ cb }: { cb: () => void }) => {
            const ref = useRef(target);
            useSwipe(ref, { onLeft: cb });
        }, { initialProps: { cb: firstLeft } });

        dispatchPointer(target, 'pointerdown', 200, 100);
        rerender({ cb: secondLeft }); // new identity, simulates parent re-render
        dispatchPointer(target, 'pointerup', 80, 110);

        // Pointer tracking must persist across the re-render and call the latest cb.
        expect(firstLeft).not.toHaveBeenCalled();
        expect(secondLeft).toHaveBeenCalledOnce();
    });
});
