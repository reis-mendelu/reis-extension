import { describe, it, expect } from 'vitest';
import { ExamSubjectSchema } from '../examSchema';

describe('ExamSubjectSchema', () => {
    const goldStandardSubject = {
        version: 1,
        id: 'EBC-ALG',
        name: 'Algoritmizace',
        code: 'EBC-ALG',
        sections: [
            {
                id: 'EBC-ALG-zkouska',
                name: 'Zkouška',
                type: 'exam',
                status: 'registered',
                registeredTerm: {
                    id: '12345',
                    date: '01.01.2026',
                    time: '10:00',
                    room: 'Q01',
                    teacher: 'Jan Novák',
                    teacherId: '9876',
                    deregistrationDeadline: '31.12.2025 23:59'
                },
                terms: [
                    {
                        id: '12346',
                        date: '05.01.2026',
                        time: '14:00',
                        capacity: '10/20',
                        full: false,
                        room: 'Q02',
                        teacher: 'Petr Svoboda',
                        teacherId: '5432',
                        registrationStart: '01.12.2025 08:00',
                        registrationEnd: '04.01.2026 23:59',
                        attemptType: 'regular',
                        canRegisterNow: true
                    }
                ]
            }
        ]
    };

    it('validates the "Gold Standard" mock data', () => {
        const result = ExamSubjectSchema.safeParse(goldStandardSubject);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sections[0].terms[0].capacity).toEqual({
                occupied: 10,
                total: 20,
                raw: '10/20'
            });
        }
    });

    it('rejects data missing version field', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const badData = { ...goldStandardSubject } as any;
        delete badData.version;
        const result = ExamSubjectSchema.safeParse(badData);
        expect(result.success).toBe(false);
    });

    it('normalizes capacity strings using transformation', () => {
        const dataWithMessyCapacity = {
            ...goldStandardSubject,
            sections: [
                {
                    ...goldStandardSubject.sections[0],
                    terms: [
                        {
                            ...goldStandardSubject.sections[0].terms[0],
                            capacity: ' 15 / 30 ' // Messy string
                        }
                    ]
                }
            ]
        };
        const result = ExamSubjectSchema.safeParse(dataWithMessyCapacity);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.sections[0].terms[0].capacity).toEqual({
                occupied: 15,
                total: 30,
                raw: '15/30'
            });
        }
    });

    it('rejects invalid attempt types', () => {
        const badData = {
            ...goldStandardSubject,
            sections: [
                {
                    ...goldStandardSubject.sections[0],
                    terms: [
                        {
                            ...goldStandardSubject.sections[0].terms[0],
                            attemptType: 'invalid-type'
                        }
                    ]
                }
            ]
        };
        const result = ExamSubjectSchema.safeParse(badData);
        expect(result.success).toBe(false);
    });
});
