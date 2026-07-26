import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SubjectInfo } from '../../../../types/documents';

describe('SubjectDrawerSheet', () => {
    beforeEach(() => {
        useAppStore.setState({
            language: 'cz',
            mobileSheets: [],
            syncStatus: { isSyncing: false, lastSync: 1, error: null, handshakeDone: true, handshakeTimedOut: false },
            subjects: { version: 1, lastUpdated: '', data: {} },
            schedule: { data: [], status: 'success', weekStart: null },
        } as never);
    });

    it('opens on the files tab when the subject has a subjectId (enrolled)', () => {
        const enrolledSubject: SubjectInfo = {
            displayName: 'ALG',
            fullName: 'Algoritmizace',
            subjectCode: 'ALG',
            subjectId: '159410', // Present = enrolled
            folderUrl: 'https://is.mendelu.cz/auth/katalog/predmety.pl?predmet=159410',
            fetchedAt: new Date().toISOString(),
        };

        useAppStore.setState({
            subjects: {
                version: 1,
                lastUpdated: new Date().toISOString(),
                data: { ALG: enrolledSubject },
            },
            files: { ALG: [] },
            lastFilesFetchedAt: { ALG: Date.now() },
        } as never);

        const onClose = vi.fn();
        render(
            <SubjectDrawerSheet
                sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
                onClose={onClose}
            />
        );

        // The files tab should be active (marked with border-primary)
        // Check that the active tab button has the primary border
        const fileButtons = screen.getAllByRole('button');
        const filesButton = fileButtons.find((btn) => btn.textContent.includes('Soubory'));
        expect(filesButton).toHaveClass('border-primary', 'text-primary');

        // The files body should be rendered (not the stats body)
        // FileList renders grouped files; when empty, it shows the empty state with FileText icon
        expect(screen.getByText('Žádné soubory nejsou k dispozici.')).toBeInTheDocument();
    });

    it('opens on the stats tab when the subject has no subjectId (not enrolled)', () => {
        const unenrolledSubject: SubjectInfo = {
            displayName: 'BIO',
            fullName: 'Biologie',
            subjectCode: 'BIO',
            // No subjectId = not enrolled
            folderUrl: 'https://is.mendelu.cz/auth/katalog/predmety.pl',
            fetchedAt: new Date().toISOString(),
        };

        useAppStore.setState({
            subjects: {
                version: 1,
                lastUpdated: new Date().toISOString(),
                data: { BIO: unenrolledSubject },
            },
        } as never);

        const onClose = vi.fn();
        render(
            <SubjectDrawerSheet
                sheet={{ kind: 'subjectDrawer', courseCode: 'BIO', courseName: 'Biologie' }}
                onClose={onClose}
            />
        );

        // The stats tab should be active (marked with border-primary)
        const fileButtons = screen.getAllByRole('button');
        const statsButton = fileButtons.find((btn) => btn.textContent.includes('Úspěšnost'));
        expect(statsButton).toHaveClass('border-primary', 'text-primary');

        // The files body should NOT be rendered; the files empty state message should not appear
        expect(screen.queryByText('Žádné soubory nejsou k dispozici.')).not.toBeInTheDocument();
    });
});
