import { useEffect, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { logError } from '../utils/reportError';

const KEYBOARD_THRESHOLD_PX = 150;

/**
 * Owns the mobile-environment side effects of the iframe app:
 *  - feeds viewport state into the Zustand slice (isTouch / isNarrow / isPortrait /
 *    keyboardOpen / viewportHeight) from matchMedia + visualViewport
 *  - writes `--app-vh` on <html> so CSS can size to the *visual* viewport
 *  - toggles data-keyboard-open on <html> for keyboard-aware utilities
 * Single mount point. No render output of its own.
 */
export function AppShell({ children }: { children: ReactNode }) {
    const setViewport = useAppStore((s) => s.setViewport);

    useEffect(() => {
        try {
            const root = document.documentElement;

            const coarse = window.matchMedia('(pointer: coarse)');
            const narrow = window.matchMedia('(max-width: 767px)');
            const portrait = window.matchMedia('(orientation: portrait)');

            const update = () => {
                const vv = window.visualViewport;
                const innerH = window.innerHeight;
                const vvH = vv?.height ?? innerH;
                const keyboardOpen = innerH - vvH > KEYBOARD_THRESHOLD_PX;

                setViewport({
                    isTouch: coarse.matches,
                    isNarrow: narrow.matches,
                    isPortrait: portrait.matches,
                    keyboardOpen,
                    viewportHeight: vvH,
                });
                root.style.setProperty('--app-vh', `${vvH}px`);
                root.dataset.keyboardOpen = String(keyboardOpen);
            };

            update();
            coarse.addEventListener('change', update);
            narrow.addEventListener('change', update);
            portrait.addEventListener('change', update);
            window.visualViewport?.addEventListener('resize', update);
            window.addEventListener('resize', update);
            window.addEventListener('orientationchange', update);

            return () => {
                coarse.removeEventListener('change', update);
                narrow.removeEventListener('change', update);
                portrait.removeEventListener('change', update);
                window.visualViewport?.removeEventListener('resize', update);
                window.removeEventListener('resize', update);
                window.removeEventListener('orientationchange', update);
            };
        } catch (err) {
            logError('Viewport.init', err);
        }
    }, [setViewport]);

    return <>{children}</>;
}
