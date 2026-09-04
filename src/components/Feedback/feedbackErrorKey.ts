import type { SubmitResult } from '../../types/suggestions';

type FailureReason = Extract<SubmitResult, { ok: false }>['error'];

/**
 * Which sentence a failed submission earns.
 *
 * All four used to share one — "Nepodařilo se odeslat zpětnou vazbu." — and a
 * student reads that as "it broke", so they retry. Two of the four are not
 * breakages and retrying is the wrong move:
 *
 *  - `rate_limited` is the server saying no on purpose. `submit_suggestion`
 *    buckets by `browser_name|browser_version` at 100/hour, which is a whole
 *    PLATFORM's allowance rather than one student's, so an ordinary user can
 *    meet it having sent nothing at all. Retrying cannot succeed.
 *  - `offline` is fixable, and only the student can fix it.
 *
 * `upstream` and `invalid` keep the original copy: those really are failures,
 * and `invalid` is unreachable from the real UI, which enforces the same
 * limits with `maxLength`.
 */
export function feedbackErrorKey(reason: FailureReason | undefined): string {
  if (reason === 'offline') return 'feedback.toastOffline';
  if (reason === 'rate_limited') return 'feedback.toastRateLimited';
  return 'feedback.toastError';
}
