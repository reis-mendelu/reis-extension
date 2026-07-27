import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (k: string) => k,
        language: mockLanguage,
    }),
}));

vi.mock('@/hooks/useUserParams', () => ({
    useUserParams: () => ({ params: mockParams }),
}));

let mockLanguage = 'cz';
let mockParams: { studium?: string } | null = { studium: '99999' };

import { SubjectsPanelHeader } from '../SubjectsPanelHeader';

const renderHeader = () =>
    render(
        <SubjectsPanelHeader
            creditsAcquired={30}
            creditsRequired={180}
            studyStats={null}
            plan={null}
        />,
    );

const linkByLabel = (label: string) => screen.getByRole('link', { name: label });

describe('SubjectsPanelHeader IS shortcuts', () => {
    beforeEach(() => {
        mockLanguage = 'cz';
        mockParams = { studium: '99999' };
    });

    it('links to the course evaluation survey alongside registrations', () => {
        renderHeader();
        expect(linkByLabel('sidebar.evaluation')).toHaveAttribute(
            'href',
            'https://is.mendelu.cz/auth/student/vyplneni_ankety.pl?studium=99999;lang=cz',
        );
        expect(linkByLabel('sidebar.registrations')).toHaveAttribute(
            'href',
            'https://is.mendelu.cz/auth/student/registrace.pl?studium=99999;lang=cz',
        );
    });

    it('opens both shortcuts in a new tab without leaking the referrer', () => {
        renderHeader();
        for (const label of ['sidebar.registrations', 'sidebar.evaluation']) {
            const link = linkByLabel(label);
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });

    it('carries the English lang param when the UI is in English', () => {
        mockLanguage = 'en';
        renderHeader();
        expect(linkByLabel('sidebar.evaluation')).toHaveAttribute(
            'href',
            'https://is.mendelu.cz/auth/student/vyplneni_ankety.pl?studium=99999;lang=en',
        );
    });

    it('omits studium entirely when user params have not resolved', () => {
        // IS falls back to the active study; emitting `studium=undefined` would 500.
        mockParams = null;
        renderHeader();
        expect(linkByLabel('sidebar.evaluation')).toHaveAttribute(
            'href',
            'https://is.mendelu.cz/auth/student/vyplneni_ankety.pl?lang=cz',
        );
    });

    it('keeps the label accessible even though it is visually hidden on mobile', () => {
        renderHeader();
        // The <span> is `hidden md:inline`, so aria-label/title are what a phone
        // user and a screen reader rely on.
        expect(linkByLabel('sidebar.evaluation')).toHaveAttribute('title', 'sidebar.evaluation');
    });

    it('shows the short label but exposes the full name to assistive tech', () => {
        // Visible text drops the redundant "předmětů"; the accessible name must not,
        // or the icon-only mobile state becomes unidentifiable.
        renderHeader();
        const link = linkByLabel('sidebar.evaluation');
        expect(link).toHaveTextContent('subjects.evaluationShort');
        expect(link).not.toHaveTextContent('sidebar.evaluation');
    });

    it('renders both shortcuts inside one shared bordered group', () => {
        // The segmented look is the point — two separate boxes is what this replaced.
        renderHeader();
        const a = linkByLabel('sidebar.registrations');
        const b = linkByLabel('sidebar.evaluation');
        expect(a.parentElement).toBe(b.parentElement);
        expect(a.parentElement?.className).toMatch(/border/);
    });

    it('gives each shortcut its own icon so the icon-only state stays distinguishable', () => {
        renderHeader();
        const iconOf = (label: string) =>
            linkByLabel(label).querySelector('svg')?.getAttribute('class') ?? '';
        expect(iconOf('sidebar.registrations')).not.toBe('');
        expect(iconOf('sidebar.evaluation')).not.toBe('');
        expect(iconOf('sidebar.registrations')).not.toBe(iconOf('sidebar.evaluation'));
    });
});
