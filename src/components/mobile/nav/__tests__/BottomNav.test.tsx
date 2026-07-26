import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';
import { useAppStore } from '../../../../store/useAppStore';

describe('BottomNav', () => {
    beforeEach(() => {
        useAppStore.setState({ mobileTab: 'calendar', language: 'cz' });
    });

    it('renders five tabs', () => {
        render(<BottomNav />);
        expect(screen.getAllByRole('tab')).toHaveLength(5);
    });

    it('labels only the active tab', () => {
        render(<BottomNav />);
        expect(screen.getByText('Kalendář')).toBeInTheDocument();
        expect(screen.queryByText('Zkoušky')).not.toBeInTheDocument();
    });

    it('marks the active tab with aria-selected', () => {
        render(<BottomNav />);
        const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
        expect(selected).toHaveLength(1);
    });

    it('switches the tab on click', () => {
        render(<BottomNav />);
        fireEvent.click(screen.getByRole('tab', { name: 'Zkoušky' }));
        expect(useAppStore.getState().mobileTab).toBe('exams');
    });
});
