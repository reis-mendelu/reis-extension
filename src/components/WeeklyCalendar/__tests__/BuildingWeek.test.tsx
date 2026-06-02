import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const requestData = vi.fn();
vi.mock('../../../api/proxyClient', () => ({ requestData: (t: string) => requestData(t) }));
vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (k: string) => k, language: 'en' }),
}));

import { BuildingWeek } from '../BuildingWeek';

describe('BuildingWeek', () => {
    it('shows the building message while loading (not timed out)', () => {
        render(<BuildingWeek timedOut={false} />);
        expect(screen.getByText('calendar.buildingWeek')).toBeInTheDocument();
        expect(screen.queryByText('calendar.retry')).not.toBeInTheDocument();
    });

    it('shows a retry button after timeout and re-requests data on click', () => {
        render(<BuildingWeek timedOut={true} />);
        expect(screen.getByText('calendar.buildingWeekFailed')).toBeInTheDocument();
        fireEvent.click(screen.getByText('calendar.retry'));
        expect(requestData).toHaveBeenCalledWith('all');
    });
});
