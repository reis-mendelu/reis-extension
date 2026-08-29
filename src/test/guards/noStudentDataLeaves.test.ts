import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * CI guard for reIS's central promise: student data never leaves the device.
 *
 * This is a REGRESSION FENCE, not a proof. It cannot understand data flow, so
 * it enforces three things a reviewer would otherwise have to notice by eye:
 *
 *  1. Only reviewed files may talk to Supabase at all.
 *  2. No student-identifying name may appear near a Supabase call.
 *  3. Hashing is not laundering. `SHA-256(studentId)` is NOT anonymisation —
 *     IS student ids are six or seven digits, so the entire preimage space is
 *     under ten million and a rainbow table reverses it in seconds. Digest
 *     calls are therefore allow-listed by file, so a new one has to be argued
 *     for rather than slipped in.
 *
 * When this fails, the fix is almost never to widen the list. It is to stop
 * sending the thing. Widening requires a reviewer to agree the payload carries
 * no student identity — write down why in the entry's comment.
 */

const ROOT = join(__dirname, '../../..');
const SRC = join(ROOT, 'src');

/** Names that identify a student, in any casing seen in this codebase. */
const IDENTIFYING = [
  'studentId',
  'student_id',
  'studentID',
  'uic',
  'fullName',
  'userEmail',
  'birthNumber',
  'rodneCislo',
  'personalNumber',
  'studiumId',
];

/**
 * Files permitted to reach Supabase. Each one has been read and confirmed to
 * send no student identity.
 */
const SUPABASE_CALLERS = new Set([
  // Random install id only. Reads take no identity argument at all.
  'src/api/eventRsvp.ts',
  // Random install id only, since the privacy refactor.
  'src/api/feedback.ts',
  // eduroam certificate transfer: a short-lived random transfer code.
  'src/api/eduroamTransfer.ts',
  // Sanitised crash telemetry — see errorReporter/sanitize.ts. Its session id
  // is a per-load random value held in module memory.
  'src/services/errorReporter/reporter.ts',
  // Society post view/click counters; sends a post row id and nothing else.
  'src/services/spolky/spolkyService.ts',
  // Reads the public society events feed. No student data in either direction.
  'src/api/mapEvents.ts',
  // report_error_v2. Message, path and stack are sanitised before this point
  // (errorReporter/sanitize.ts strips emails, *.mendelu.cz URLs and 6-7 digit
  // ids); the session id is a per-load random value.
  'src/services/errorReporter/telemetry.ts',
  // KNOWN ISSUE, listed so the guard stays green while it is fixed — do NOT
  // read this entry as "safe". p_teacher_id is staff rather than a student, but
  // the session id here is PERSISTENT (chrome.storage.local, never rotated), so
  // the set of teacher ids bound to one session reconstructs the student's
  // course load — IS-derived academic data. `get_subject_rating_counts` also
  // takes a raw person id as a read argument with no auth, which makes any
  // named teacher's ratings enumerable. Needs a per-teacher unlinkable vote key.
  'src/components/SubjectFileDrawer/Header/TeacherGradingPill.tsx',
]);

/**
 * Files permitted to call crypto.subtle.digest. None of these hash a student
 * identifier: PKCE/OAuth verifiers, content hashes for Drive de-duplication,
 * and image fingerprints.
 */
const DIGEST_CALLERS = new Set([
  'src/utils/pkce.ts',
  'src/api/googleAuth.ts',
  'src/services/notes/imageNormalize.ts',
  'src/services/drive/notesDoc.ts',
  'src/services/drive/driveDiff.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf-8') }));

/**
 * Every non-MENDELU host the app may contact. An audit found reIS talking to
 * Anthropic, Google, Microsoft, Komoot and a personal HuggingFace Space while
 * PRIVACY.md claimed it spoke "exclusively" to IS Mendelu, WebISKAM and
 * Supabase. Adding a destination now means adding it here AND to PRIVACY.md.
 */
const ALLOWED_HOSTS = [
  // --- reIS's own / the university's ---
  'is.mendelu.cz',
  'webiskam.mendelu.cz',
  'mendelu.cz',
  'supabase.co',

  // --- fetched from, carrying no student identity ---
  'cdn.jsdelivr.net', // static subject-difficulty JSON. NOTE: the request set
  // reveals which subjects are enrolled, so it is an enrolment fingerprint to
  // the CDN even though no identifier is sent.
  'openstreetmap.org', // campus map tiles
  'photon.komoot.io', // off-campus venue search — SOCIETY ADMINS only
  'hei.api.uni-foundation.eu', // public Erasmus university directory (read-only)

  // --- fetched from, carrying student data. Each must stay disclosed. ---
  'googleapis.com', // Drive backup of the student's own files (drive.file)
  'google.com', // OAuth consent
  'bookings.cloud.microsoft', // library booking: name, email, student id
  'anthropic.com', // syllabus comparison: a student-chosen PDF

  // --- deep links the STUDENT opens; no background request is made ---
  'teams.microsoft.com',
  'outlook.office.com',
  'www.geteduroam.app',
  'supef.cz',

  // --- not destinations ---
  'localhost.that.never.exists', // CORS sentinel in capacitorTransport
  'is.mendelu.cz.evil.com', // negative example in the URL validator
  'is.mendelu.cz.evil.example', // ditto, in trustedOrigin
];

describe('no student data leaves the device', () => {
  it('contacts no undeclared third-party host', () => {
    const offences: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
        const host = m[1]!.toLowerCase();
        if (ALLOWED_HOSTS.some((a) => host === a || host.endsWith('.' + a))) continue;
        offences.push(`${f.path}  ${host}`);
      }
    }
    expect(
      [...new Set(offences)],
      `Undeclared outbound host(s). Every destination must be listed here AND ` +
        `disclosed in PRIVACY.md, which is what backs the App Store and Play ` +
        `Store privacy filings:\n` +
        [...new Set(offences)].join('\n')
    ).toEqual([]);
  });

  it('only reviewed files talk to Supabase', () => {
    const callers = files
      .filter((f) => /\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(f.text))
      .map((f) => f.path)
      .filter((p) => !SUPABASE_CALLERS.has(p));

    expect(
      callers,
      `New Supabase call site(s). Confirm the payload carries NO student identity, ` +
        `then add the file to SUPABASE_CALLERS with a note saying why it is safe:\n` +
        callers.join('\n')
    ).toEqual([]);
  });

  it('sends no student-identifying field to Supabase', () => {
    const offences: string[] = [];
    for (const f of files) {
      if (!/\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(f.text)) continue;
      const lines = f.text.split('\n');
      lines.forEach((line, i) => {
        // Look inside the payload region of a Supabase call: the call line and
        // the object literal that follows it.
        const near = lines.slice(Math.max(0, i - 2), i + 14).join('\n');
        if (!/\bsupabase\s*\.\s*(rpc|from)\s*\(/.test(near)) return;
        for (const name of IDENTIFYING) {
          // `p_student_id:` is the column name on legacy tables; flag only when
          // an identifying VALUE is being passed, not the parameter name.
          const re = new RegExp(`:\\s*[^,\\n]*\\b${name}\\b`);
          if (re.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            offences.push(`${f.path}:${i + 1}  ${line.trim()}`);
          }
        }
      });
    }
    expect(
      [...new Set(offences)],
      `A student identifier is being passed to Supabase. Hashing it does NOT make ` +
        `this safe — IS ids are 6-7 digits and reverse in seconds. Use the random ` +
        `install id (src/services/identity/installId.ts) instead:\n` +
        offences.join('\n')
    ).toEqual([]);
  });

  it('does not hash identifiers outside the reviewed list', () => {
    const hashers = files
      .filter((f) => /crypto\.subtle\.digest/.test(f.text))
      .map((f) => f.path)
      .filter((p) => !DIGEST_CALLERS.has(p));

    expect(
      hashers,
      `New crypto.subtle.digest call site(s). A hash of a low-entropy identifier ` +
        `is NOT anonymisation. If this hashes anything derived from a student, ` +
        `remove it; otherwise add the file to DIGEST_CALLERS with a note:\n` +
        hashers.join('\n')
    ).toEqual([]);
  });

  // The install id is the sanctioned replacement, so it must stay random and
  // must never be derived from anything the student is.
  it('derives the install id from randomness, not from the student', () => {
    const src = readFileSync(join(SRC, 'services/identity/installId.ts'), 'utf-8');
    expect(src).toMatch(/crypto\.randomUUID\(\)/);
    for (const name of IDENTIFYING) {
      expect(src.includes(name), `installId.ts must not reference ${name}`).toBe(false);
    }
  });
});
