import { Component, type ReactNode } from 'react';
import { logError } from '../../utils/reportError';

interface ErrorBoundaryProps {
    /** Rendered instead of children when a descendant throws (incl. a failed lazy import). */
    fallback: ReactNode;
    /** When this value changes, the boundary clears its error and re-renders children. */
    resetKey?: unknown;
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Minimal error boundary. React error boundaries must be class components —
 * there is no hook equivalent. Used to stop a failed lazy import (chunk load
 * failure) from blanking the whole iframe app, and to offer an escape hatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        logError('ErrorBoundary', error);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}
