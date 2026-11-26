import { z } from 'zod';

/**
 * Normalizes capacity string "10 / 20" into structured object.
 */
export const ExamCapacitySchema = z.string().transform((val) => {
  const clean = val.trim().replace(/\s+/g, '');
  // Strip trailing "(n)" suffix before parsing: "12(8)" → "12". IS calls it
  // "Rezerva" on the term's detail page, and a reserve takes the seat (see
  // `reserve` below), so it is kept rather than thrown away.
  const [occupied, total] = clean.split('/').map((s) => Number(s.replace(/\(\d+\)$/, '')));
  const occupiedNum = occupied ?? NaN;
  const totalNum = total ?? NaN;
  const reserve = Number(clean.match(/\((\d+)\)$/)?.[1] ?? 0);
  return {
    occupied: isNaN(occupiedNum) ? 0 : occupiedNum,
    total: isNaN(totalNum) ? 0 : totalNum,
    raw: clean,
    // Only when there is one, so a term without a reserve keeps its old shape.
    ...(reserve > 0 ? { reserve } : {}),
  };
});

export const ExamTermSchema = z
  .object({
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
    deregistrationDeadline: z.string().optional(),
    attemptTypes: z.array(z.enum(['regular', 'retake1', 'retake2', 'retake3'])).optional(),
    canRegisterNow: z.boolean().optional(),
    sectionForm: z.string().optional(),
    sectionFormCs: z.string().optional(),
    sectionFormEn: z.string().optional(),
    watchdogUrl: z.string().optional(),
    blockReasonUrl: z.string().optional(),
    detailUrl: z.string().optional(),
    durationMinutes: z.number().nullable().optional(),
    cannotRegister: z.boolean().optional(),
  })
  // A reserve takes the seat: IS's "59/60(1)" (read 2026-11-25) offers no
  // "Přihlásit" and its reason page says "Tento termín je již obsazený". The
  // parser only compares occupied with the total, so the term is marked full
  // here, where every reader of `full` gets it.
  .transform((term) => {
    const c = term.capacity;
    const taken = !!c && c.total > 0 && c.occupied + (c.reserve ?? 0) >= c.total;
    return taken && !term.full ? { ...term, full: true } : term;
  });

export const ExamSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameCs: z.string().optional(),
  nameEn: z.string().optional(),
  type: z.string(),
  status: z.enum(['registered', 'available', 'open']),
  registeredTerm: z
    .object({
      id: z.string().optional(),
      date: z.string(),
      time: z.string(),
      room: z.string().optional(),
      teacher: z.string().optional(),
      teacherId: z.string().optional(),
      roomCs: z.string().optional(),
      roomEn: z.string().optional(),
      deregistrationDeadline: z.string().optional(),
    })
    .optional(),
  terms: z.array(ExamTermSchema),
});

/**
 * Branded Exam Subject Schema for 100% data integrity.
 * Versioned for future IndexedDB migrations.
 */
export const ExamSubjectSchema = z
  .object({
    version: z.literal(1),
    id: z.string(),
    name: z.string(),
    nameCs: z.string().optional(),
    nameEn: z.string().optional(),
    code: z.string(),
    sections: z.array(ExamSectionSchema),
  })
  .brand<'Exam'>();

export type ExamSubject = z.infer<typeof ExamSubjectSchema>;
