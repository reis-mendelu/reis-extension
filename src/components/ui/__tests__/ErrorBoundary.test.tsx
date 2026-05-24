import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb({ boom }: { boom: boolean }) {
    if (boom) throw new Error('kaboom');
    return <div data-testid="ok">ok</div>;
}

afterEach(cleanup);

describe('ErrorBoundary', () => {
    it('renders children when nothing throws', () => {
        render(<ErrorBoundary fallback={<div data-testid="fb" />}><Bomb boom={false} /></ErrorBoundary>);
        expect(screen.getByTestId('ok')).toBeInTheDocument();
    });

    it('renders the fallback when a child throws', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ErrorBoundary fallback={<div data-testid="fb" />}><Bomb boom /></ErrorBoundary>);
        expect(screen.getByTestId('fb')).toBeInTheDocument();
        spy.mockRestore();
    });

    it('recovers when resetKey changes', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(
            <ErrorBoundary resetKey="a" fallback={<div data-testid="fb" />}><Bomb boom /></ErrorBoundary>,
        );
        expect(screen.getByTestId('fb')).toBeInTheDocument();
        rerender(
            <ErrorBoundary resetKey="b" fallback={<div data-testid="fb" />}><Bomb boom={false} /></ErrorBoundary>,
        );
        expect(screen.getByTestId('ok')).toBeInTheDocument();
        spy.mockRestore();
    });
});
