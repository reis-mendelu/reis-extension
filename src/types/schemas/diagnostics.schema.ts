import { z } from 'zod';
import type { DiagnosticsPayload } from '../../utils/diagnostics/collectDiagnostics';

// The shape `collectDiagnostics` sends. The server checks only that the value
// is an object with an `entries` array of at most 50 and a size cap — anyone
// can call the report RPC with the publishable key — so the admin inbox parses what it reads
// back rather than trusting it. A row that fails renders as "no diagnostics"
// instead of throwing inside the console, which has no error boundary.
export const DiagnosticsPayloadSchema = z.object({
  entries: z
    .array(
      z.object({
        t: z.number(),
        level: z.enum(['error', 'warn']),
        source: z.enum(['app', 'content']),
        ctx: z.string().nullable(),
        status: z.number().optional(),
        msg: z.string(),
      })
    )
    .max(50),
  env: z.object({
    platform: z.enum(['extension', 'ios', 'android', 'web']),
    os: z.string(),
    lang: z.enum(['cz', 'en']),
    online: z.boolean(),
    uptimeS: z.number(),
  }),
  sync: z.object({
    lastSync: z.number().nullable(),
    isSyncing: z.boolean(),
    schedule: z.string(),
    exams: z.string(),
    scheduleCount: z.number(),
    examsCount: z.number(),
    examsFetchedAt: z.number().nullable(),
  }),
}) satisfies z.ZodType<DiagnosticsPayload>;

export function parseDiagnostics(raw: unknown): DiagnosticsPayload | null {
  const r = DiagnosticsPayloadSchema.safeParse(raw);
  return r.success ? r.data : null;
}
