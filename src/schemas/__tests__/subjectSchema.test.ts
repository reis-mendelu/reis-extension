import { describe, it, expect } from 'vitest';
import { SubjectInfoSchema, SubjectsDataSchema } from '../subjectSchema';

describe('SubjectSchema', () => {
    const goldStandardSubject = {
        displayName: 'Algoritmizace',
        fullName: 'Algoritmizace (EBC-ALG)',
        subjectCode: 'EBC-ALG',
        subjectId: '12345',
        folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=54321',
        fetchedAt: '2026-01-26T10:00:00.000Z'
    };

    const goldStandardData = {
        lastUpdated: '2026-01-26T10:00:00.000Z',
        version: 1,
        data: {
            'EBC-ALG': goldStandardSubject
        }
    };

    it('validates the "Gold Standard" subject info', () => {
        const result = SubjectInfoSchema.safeParse(goldStandardSubject);
        expect(result.success).toBe(true);
    });

    it('validates the "Gold Standard" subjects data wrapper', () => {
        const result = SubjectsDataSchema.safeParse(goldStandardData);
        expect(result.success).toBe(true);
    });

    it('rejects subjects data missing version', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const badData = { ...goldStandardData } as any;
        delete badData.version;
        const result = SubjectsDataSchema.safeParse(badData);
        expect(result.success).toBe(false);
    });

    it('normalizes subject names (trims)', () => {
        const messySubject = {
            ...goldStandardSubject,
            displayName: '  Messy Name  '
        };
        const result = SubjectInfoSchema.safeParse(messySubject);
        if (result.success) {
            expect(result.data.displayName).toBe('Messy Name');
        }
    });
});
