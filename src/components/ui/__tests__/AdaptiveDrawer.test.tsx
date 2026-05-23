import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AdaptiveDrawer } from '../AdaptiveDrawer';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
    cleanup();
    useAppStore.setState({ isTouch: false, isNarrow: false, keyboardOpen: false });
});

describe('AdaptiveDrawer', () => {
    it('renders nothing when closed', () => {
        const { container } = render(
            <AdaptiveDrawer open={false} onClose={() => {}}>
                <div>content</div>
            </AdaptiveDrawer>,
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders desktop side drawer when not (isTouch && isNarrow)', () => {
        useAppStore.setState({ isTouch: false, isNarrow: false });
        render(
            <AdaptiveDrawer open onClose={() => {}}>
                <div data-testid="body">content</div>
            </AdaptiveDrawer>,
        );
        const body = screen.getByTestId('body');
        expect(body.closest('[role="dialog"]')?.className).toContain('slide-in-from-right');
    });

    it('renders desktop side drawer on tablet (isTouch but not isNarrow)', () => {
        useAppStore.setState({ isTouch: true, isNarrow: false });
        render(
            <AdaptiveDrawer open onClose={() => {}}>
                <div data-testid="body">content</div>
            </AdaptiveDrawer>,
        );
        const body = screen.getByTestId('body');
        expect(body.closest('[role="dialog"]')?.className).toContain('slide-in-from-right');
    });

    it('renders bottom-direction vaul drawer when isTouch && isNarrow', () => {
        useAppStore.setState({ isTouch: true, isNarrow: true });
        render(
            <AdaptiveDrawer open onClose={() => {}}>
                <div data-testid="body">content</div>
            </AdaptiveDrawer>,
        );
        // Vaul DrawerContent receives data-vaul-drawer-direction="bottom"
        const bottomDrawer = document.querySelector('[data-vaul-drawer-direction="bottom"]');
        expect(bottomDrawer).not.toBeNull();
    });
});
