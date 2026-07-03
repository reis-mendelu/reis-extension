# Bad-rating reason tracking

## Problem

`NpsBanner.tsx` (rendered directly under the header via `AppMain.tsx`) shows a 1–5
rating. Ratings ≥4 trigger a share-to-store prompt before submitting; ratings ≤3
submit instantly via `submitFeedback(studentId, 'nps', String(rating), semesterCode)`.
A bad rating carries no information about *why* — reis-admin's existing NPS
analytics section shows only the numeric distribution. We want ratings of 3 or
worse to prompt for a specific reason, and that reason to be visible in reis-admin
alongside the existing NPS chart.

## Scope

Extension: `NpsBanner`, `createFeedbackSlice`, `api/feedback.ts`, Supabase schema.
Admin: `useFeedbackStats`, `AnalyticsView.tsx`. No new UI surfaces, no free text,
no changes to the ≥4 share-prompt flow or feedback eligibility gating (unchanged:
3-session warmup, one submission per semester, tracked via IndexedDB `meta.reis_feedback`).

## UI behavior

When the user taps a rating of 1–3, the rating row is replaced **inline** (same
mechanism the banner already uses for the ≥4 share prompt) with 5 category chips:

| Code | Czech | English |
|------|-------|---------|
| `missing_feature` | Nemá to co potřebuji | Doesn't have what I need |
| `bug` | Nefunguje to | Doesn't work |
| `confusing` | Nepřehledné | Confusing |
| `slow` | Pomalé | Too slow |
| `other` | Jiné | Other |

Tapping a chip submits the rating **and** the reason together in one call, then
shows the existing thank-you toast and the banner disappears (same
eligibility-consumed behavior as today).

**Deliberate behavior change:** there is no ✕/skip at the chip step. A rating of
≤3 is only ever recorded once a category is picked — unlike today, where all
ratings submit instantly. The ✕ dismiss on the *initial* rating row (before any
rating is picked) is unchanged. The ≥4 share-prompt flow and its ✕ (which still
submits the bare rating) are also unchanged.

## Data flow

```
tap rating (1-3) → chips shown (no submit yet) → tap category
  → submitNps(rating, reasonCode)
    → submitFeedback(studentId, 'nps', String(rating), semesterCode, reasonCode)
      → supabase.rpc('submit_feedback', { ..., p_reason: reasonCode })
        → upsert into feedback_responses (reason column)
```

## Schema change (Supabase, migration lives in reis-admin repo next to the
original `feedback_responses` migration)

```sql
ALTER TABLE feedback_responses
    ADD COLUMN reason text
    CHECK (reason IN ('missing_feature', 'bug', 'confusing', 'slow', 'other'));

CREATE OR REPLACE FUNCTION submit_feedback(
    p_student_id text,
    p_faculty_id text,
    p_study_semester int,
    p_feedback_type text,
    p_value text,
    p_semester_code text,
    p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO feedback_responses (student_id, faculty_id, study_semester, feedback_type, value, semester_code, reason)
    VALUES (p_student_id, p_faculty_id, p_study_semester, p_feedback_type, p_value, p_semester_code, p_reason)
    ON CONFLICT (student_id, feedback_type, semester_code)
    DO UPDATE SET value = p_value, faculty_id = p_faculty_id, study_semester = p_study_semester,
        reason = p_reason, created_at = now();
END;
$$;
```

Applying this migration to the shared production Supabase project is a
hard-to-reverse, shared-state action — it must be confirmed with the user
before running, not auto-applied.

No new sanitization work is needed: `reason` is a closed enum populated only
from chip taps, never free text, so it carries no PII risk (same reasoning as
the existing numeric `value` column).

## Component changes

- `NpsBanner.tsx`: add local state `badRating: number | null`. `handleRating`
  routes rating ≥4 to the existing `pendingRating` flow, rating ≤3 to
  `badRating` instead of instant-submitting. New render branch for the chip
  row when `badRating !== null`. Chip tap calls `submitNps(badRating, code)`.
- `createFeedbackSlice.ts`: `submitNps(rating: number, reason?: string)` —
  threads `reason` through to `submitFeedback`; store-state reset
  (`feedbackEligible: false, feedbackDismissed: true`) unchanged.
- `api/feedback.ts`: `submitFeedback(studentId, feedbackType, value,
  semesterCode, reason?)` passes `p_reason` to the RPC.
- `i18n/locales/{cs,en}.json`: add `feedback.reasonPrompt` and
  `feedback.reason.<code>` keys for the 5 chips.

## reis-admin changes

- `useFeedbackStats.ts`: alongside the existing rating-distribution query, add
  a grouped count of `reason` for rows where `feedback_type = 'nps' AND reason
  IS NOT NULL`, still respecting `semesterFilter`.
- `AnalyticsView.tsx`: render a small reason-breakdown list (category → count)
  under the existing NPS distribution chart/average, in the same section —
  no new page or route.

## Testing

- Vitest: `createFeedbackSlice.submitNps` passes `reason` through to
  `submitFeedback` when provided.
- Vitest: `NpsBanner` — tapping rating 1–3 renders chips instead of
  submitting; tapping a chip calls `submitNps` with the matching rating and
  reason code and results in the thank-you state; tapping rating ≥4 is
  unaffected (existing share-prompt flow still fires).
- reis-admin: extend/verify `useFeedbackStats` aggregation logic for the new
  reason grouping (unit test if the repo's existing test conventions support
  it; otherwise manual verification against seeded data).
