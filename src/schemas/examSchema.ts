import { z } from 'zod';

/**
 * Normalizes capacity string "10 / 20" into structured object.
 */
export const ExamCapacitySchema = z.string().transform((val) => {
    const clean = val.trim().replace(/\s+/g, '');
    const [occupied, total] = clean.split('/').map(Number);
    return {
        occupied: isNaN(occupied) ? 0 : occupied,
        total: isNaN(total) ? 0 : total,
        raw: clean,
    };
});

export const ExamTermSchema = z.object({
    id: z.string(),
    date: z.string(),
    time: z.string(),
    capacity: ExamCapacitySchema.optional(),
    full: z.boolean().optional(),
    room: z.string().optional(),
    teacher: z.string().optional(),
    teacherId: z.string().optional(),
    roomCs: z.string().optional(),
    roomEn: z.string().optional(),
    registrationStart: z.string().optional(),
    registrationEnd: z.string().optional(),
    attemptType: z.enum(['regular', 'retake1', 'retake2', 'retake3']).optional(),
    canRegisterNow: z.boolean().optional(),
});

export const ExamSectionSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    type: z.string(),
    status: z.enum(['registered', 'available', 'open']),
    registeredTerm: z.object({
        id: z.string().optional(),
        date: z.string(),
        time: z.string(),
        room: z.string().optional(),
        teacher: z.string().optional(),
        teacherId: z.string().optional(),
        roomCs: z.string().optional(),
        roomEn: z.string().optional(),
        deregistrationDeadline: z.string().optional(),
    }).optional(),
    terms: z.array(ExamTermSchema),
});

/**
 * Branded Exam Subject Schema for 100% data integrity.
 * Versioned for future IndexedDB migrations.
 */
export const ExamSubjectSchema = z.object({
    version: z.literal(1),
    id: z.string(),
    name: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    code: z.string(),
    sections: z.array(ExamSectionSchema),
}).brand<'Exam'>();

export type ExamSubject = z.infer<typeof ExamSubjectSchema>;
