import { describe, it, expect } from 'vitest';
import { SyllabusRequirementsSchema } from '../syllabusSchema';

describe('SyllabusSchema', () => {
    const goldStandardSyllabus = {
        version: 1,
        courseId: '12345',
        requirementsText: 'Basic requirements...',
        requirementsTable: [
            ['Task', 'Points'],
            ['Exam', '100']
        ],
        courseInfo: {
            credits: '5',
            garant: 'Jan Novák',
            teachers: [
                { name: 'Jan Novák', roles: 'Lecturer' },
                { name: 'Petr Svoboda', roles: 'Assistant' }
            ],
            status: 'Mandatory'
        }
    };

    it('validates the "Gold Standard" syllabus data', () => {
        const result = SyllabusRequirementsSchema.safeParse(goldStandardSyllabus);
        expect(result.success).toBe(true);
    });

    it('rejects data missing version', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const badData = { ...goldStandardSyllabus } as any;
        delete badData.version;
        const result = SyllabusRequirementsSchema.safeParse(badData);
        expect(result.success).toBe(false);
    });

    it('collects and normalizes teacher names', () => {
        const messySyllabus = {
            ...goldStandardSyllabus,
            courseInfo: {
                ...goldStandardSyllabus.courseInfo,
                teachers: [
                    { name: '  Messy Name  ', roles: ' Assistant ' }
                ]
            }
        };
        const result = SyllabusRequirementsSchema.safeParse(messySyllabus);
        if (result.success) {
            expect(result.data.courseInfo!.teachers[0].name).toBe('Messy Name');
            expect(result.data.courseInfo!.teachers[0].roles).toBe('Assistant');
        }
    });
});
