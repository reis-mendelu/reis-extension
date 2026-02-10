import { z } from 'zod';

export const CourseMetadataSchema = z.object({
    courseName: z.string().nullable().optional(),
    courseNameCs: z.string().nullable().optional(),
    courseNameEn: z.string().nullable().optional(),
    credits: z.string().nullable(),
    garant: z.string().nullable(),
    teachers: z.array(z.object({
        name: z.string().transform(s => s.trim()),
        roles: z.string().transform(s => s.trim()),
    })),
    status: z.string().nullable(),
});

export const SyllabusRequirementsSchema = z.object({
    version: z.union([z.literal(1), z.literal(2)]),
    courseId: z.string().optional(),
    requirementsText: z.string(),
    requirementsTable: z.array(z.array(z.string())),
    courseInfo: CourseMetadataSchema.optional(),
    assessmentMethods: z.string().nullable().optional(),
    assessmentCriteria: z.array(z.object({
        requirementType: z.string(),
        dailyAttendance: z.string(),
        combinedForm: z.string()
    })).optional(),
});

export type SyllabusRequirements = z.infer<typeof SyllabusRequirementsSchema>;
export type CourseMetadata = z.infer<typeof CourseMetadataSchema>;
