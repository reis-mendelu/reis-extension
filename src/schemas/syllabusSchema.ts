import { z } from 'zod';

export const CourseMetadataSchema = z.object({
    courseName: z.string().nullable().optional(),
    courseNameCs: z.string().nullable().optional(),
    courseNameEn: z.string().nullable().optional(),
    credits: z.string().nullable(),
    garant: z.object({
        name: z.string().nullable(),
        id: z.string().nullable().optional(),
    }).nullable().optional(),
    teachers: z.array(z.object({
        name: z.string().transform(s => s.trim()),
        id: z.string().nullable().optional(),
        roles: z.string().transform(s => s.trim()),
    })),
    status: z.string().nullable(),
});

export const SyllabusRequirementsSchema = z.object({
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    courseId: z.string().optional(),
    requirementsText: z.string(),
    requirementsTable: z.array(z.array(z.string())),
    courseInfo: CourseMetadataSchema.optional(),
    objectivesText: z.string().nullable().optional(),
    contentText: z.string().nullable().optional(),
});

export type SyllabusRequirements = z.infer<typeof SyllabusRequirementsSchema>;
export type CourseMetadata = z.infer<typeof CourseMetadataSchema>;
