import { ChromeAsyncStorage } from '../storage/ChromeAsyncStorage';

const VOTE_KEY_PREFIX = 'reis_grading_vote_';

/**
 * A fresh random id PER TEACHER, not one id for the whole device.
 *
 * This used to be a single persistent `reis_session_id` reused for every vote.
 * Each vote sends that id alongside a teacher id, so the set of teacher ids
 * carrying the same session id reconstructed the student's course load — IS
 * academic data, assembled server-side, from a feature that only meant to count
 * votes. Scoping the id to one teacher makes two votes by the same student
 * unlinkable, while still letting this device change or withdraw its own vote.
 *
 * Lives beside `installId` rather than in the component: both answer the same
 * question — "what random token does the server see instead of the student" —
 * and keeping them together is what makes that set auditable at a glance. The
 * guard in `src/test/guards/noStudentDataLeaves.test.ts` reads this directory.
 */
export async function getOrCreateVoteId(teacherId: string): Promise<string> {
  const key = VOTE_KEY_PREFIX + teacherId;
  const existing = await ChromeAsyncStorage.get<string>(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await ChromeAsyncStorage.set(key, id);
  return id;
}
