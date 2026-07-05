# Bad-Rating Reason Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student rates reIS 3 or worse in the existing NPS banner, prompt them (inline, via tappable category chips) for a specific reason, store it alongside the rating, and surface a reason breakdown in reis-admin's existing NPS analytics section.

**Architecture:** Thread an optional `reason` string through the existing NPS submission path (`NpsBanner` → `submitNps` store action → `submitFeedback` API → `submit_feedback` Supabase RPC → `feedback_responses.reason` column). No new tables, no new UI surfaces — the chip prompt reuses the banner's existing inline-replacement pattern (the same mechanism already used for the ≥4 share-prompt), and reis-admin's `AnalyticsView.tsx` reuses its existing `RatingBar` component for the new breakdown.

**Tech Stack:** React 19, Zustand, Vitest + Testing Library (extension); React + Supabase-js + generated `database.types.ts` (reis-admin); Postgres/PL-pgSQL (Supabase).

## Global Constraints

- Reason values are a closed 5-code enum (`missing_feature`, `bug`, `confusing`, `slow`, `other`) — never free text. No sanitization pipeline needed.
- No ✕/skip at the category-chip step — a rating of ≤3 is only ever recorded together with its reason. This is a deliberate behavior change from today's instant-submit-on-any-rating.
- Applying the Supabase migration (Task 3) changes shared production schema — it is a hard-to-reverse, shared-state action. **Do not run it without explicit user confirmation at the time**, even though the migration file itself should be created and committed.
- Existing eligibility gating (3-session warmup, one NPS submission per semester via IndexedDB `meta.reis_feedback`) is unchanged — do not touch `loadFeedbackState` or `dismissFeedback`.
- The ≥4 share-prompt flow (`pendingRating` state, `handleCopy`, `handleShareDismiss`) is unchanged.

---

### Task 1: Thread `reason` through the extension's submission path

**Files:**
- Modify: `src/store/types.ts:208` (`FeedbackSlice.submitNps` signature)
- Modify: `src/api/feedback.ts` (`submitFeedback` signature + RPC call)
- Modify: `src/store/slices/createFeedbackSlice.ts` (`submitNps` implementation)
- Test: `src/store/slices/__tests__/createFeedbackSlice.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `IndexedDBService`, `getUserParams`, `supabase.rpc`).
- Produces: `submitNps(rating: number, reason?: string): Promise<void>` — Task 2's `NpsBanner` calls this directly. `submitFeedback(studentId: string, feedbackType: 'nps' | 'one_change', value: string, semesterCode: string, reason?: string): Promise<boolean>` — signature Task 2 does not call directly but must not break.

- [ ] **Step 1: Update the existing test to expect the new 5th argument, and add a new reason-passthrough test**

In `src/store/slices/__tests__/createFeedbackSlice.test.ts`, replace the `'submitNps should call API and persist to IndexedDB'` test body and add a new test right after it:

```ts
    it('submitNps should call API and persist to IndexedDB', async () => {
        const { submitFeedback } = await import('../../../api/feedback');
        vi.mocked(IndexedDBService.get).mockResolvedValue({ sessionsUntilEligible: 0 });

        await slice.submitNps(4);

        expect(submitFeedback).toHaveBeenCalledWith('stu123', 'nps', '4', '2026S', undefined);
        expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_feedback', expect.objectContaining({
            npsSubmittedSemester: '2026S',
        }));
        expect(slice.feedbackEligible).toBe(false);
        expect(slice.feedbackDismissed).toBe(true);
    });

    it('submitNps should pass the reason through to submitFeedback when provided', async () => {
        const { submitFeedback } = await import('../../../api/feedback');
        vi.mocked(IndexedDBService.get).mockResolvedValue({ sessionsUntilEligible: 0 });

        await slice.submitNps(2, 'bug');

        expect(submitFeedback).toHaveBeenCalledWith('stu123', 'nps', '2', '2026S', 'bug');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/slices/__tests__/createFeedbackSlice.test.ts`
Expected: FAIL — the first updated assertion fails because the current implementation calls `submitFeedback` with only 4 arguments (no trailing `undefined`).

- [ ] **Step 3: Update `FeedbackSlice.submitNps` type signature**

In `src/store/types.ts`, change line 208:

```ts
    submitNps: (rating: number, reason?: string) => Promise<void>;
```

- [ ] **Step 4: Update `submitFeedback` in `src/api/feedback.ts`**

```ts
export async function submitFeedback(
    studentId: string,
    feedbackType: 'nps' | 'one_change',
    value: string,
    semesterCode: string,
    reason?: string,
): Promise<boolean> {
    const hashedId = await hashId(studentId);
    const { error } = await supabase.rpc('submit_feedback', {
        p_student_id: hashedId,
        p_faculty_id: null,
        p_study_semester: null,
        p_feedback_type: feedbackType,
        p_value: value,
        p_semester_code: semesterCode,
        p_reason: reason ?? null,
    });
    if (error) return false;

    return true;
}
```

- [ ] **Step 5: Update `submitNps` in `src/store/slices/createFeedbackSlice.ts`**

```ts
    submitNps: async (rating: number, reason?: string) => {
        const userParams = await getUserParams();
        if (!userParams) return;

        const currentSemester = getCurrentSemesterCode(userParams.obdobi);
        await submitFeedback(
            userParams.studentId,
            'nps',
            String(rating),
            currentSemester,
            reason,
        );

        const record = await IndexedDBService.get('meta', FEEDBACK_KEY) as Record<string, unknown> | undefined;
        await IndexedDBService.set('meta', FEEDBACK_KEY, {
            ...record,
            npsSubmittedSemester: currentSemester,
        });

        set({ feedbackEligible: false, feedbackDismissed: true });
    },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/store/slices/__tests__/createFeedbackSlice.test.ts`
Expected: PASS (all tests, including the two touched in Step 1)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 8: Commit**

```bash
git add src/store/types.ts src/api/feedback.ts src/store/slices/createFeedbackSlice.ts src/store/slices/__tests__/createFeedbackSlice.test.ts
git commit -m "feat(feedback): thread optional reason through NPS submission path"
```

---

### Task 2: Category-chip UI in `NpsBanner`

**Files:**
- Modify: `src/components/Feedback/NpsBanner.tsx`
- Modify: `src/i18n/locales/cs.json` (`feedback` block, after `shareCopied`)
- Modify: `src/i18n/locales/en.json` (`feedback` block, after `shareCopied`)
- Test: Create `src/components/Feedback/__tests__/NpsBanner.test.tsx`

**Interfaces:**
- Consumes: `submitNps(rating: number, reason?: string): Promise<void>` from Task 1 (via `useAppStore`).
- Produces: nothing consumed by later tasks — this is the terminal UI for the extension side.

- [ ] **Step 1: Add i18n keys**

In `src/i18n/locales/cs.json`, inside the `"feedback"` object, change:

```json
    "shareCopy": "Kopírovat odkaz",
    "shareCopied": "Zkopírováno!"
  },
```

to:

```json
    "shareCopy": "Kopírovat odkaz",
    "shareCopied": "Zkopírováno!",
    "reasonPrompt": "Co bylo špatně?",
    "reason": {
      "missing_feature": "Nemá to co potřebuji",
      "bug": "Nefunguje to",
      "confusing": "Nepřehledné",
      "slow": "Pomalé",
      "other": "Jiné"
    }
  },
```

In `src/i18n/locales/en.json`, inside the `"feedback"` object, change:

```json
    "shareCopy": "Copy link",
    "shareCopied": "Copied!"
  },
```

to:

```json
    "shareCopy": "Copy link",
    "shareCopied": "Copied!",
    "reasonPrompt": "What went wrong?",
    "reason": {
      "missing_feature": "Doesn't have what I need",
      "bug": "Doesn't work",
      "confusing": "Confusing",
      "slow": "Too slow",
      "other": "Other"
    }
  },
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/Feedback/__tests__/NpsBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NpsBanner } from '../NpsBanner';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

afterEach(() => {
    cleanup();
});

function setStoreState(overrides: Record<string, unknown> = {}) {
    useAppStore.setState({
        language: 'en',
        feedbackEligible: true,
        feedbackDismissed: false,
        submitNps: vi.fn().mockResolvedValue(undefined),
        dismissFeedback: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    });
}

describe('NpsBanner', () => {
    it('renders nothing when not eligible', () => {
        setStoreState({ feedbackEligible: false });
        const { container } = render(<NpsBanner />);
        expect(container.firstChild).toBeNull();
    });

    it('tapping rating 5 shows the share prompt, not category chips', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '5' }));
        expect(screen.getByText(/classmate/i)).toBeTruthy();
        expect(screen.queryByText("Doesn't work")).toBeNull();
        expect(useAppStore.getState().submitNps).not.toHaveBeenCalled();
    });

    it('tapping a rating of 1-3 shows category chips instead of submitting immediately', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        expect(useAppStore.getState().submitNps).not.toHaveBeenCalled();
        expect(screen.getByText("Doesn't work")).toBeTruthy();
        expect(screen.getByText('Confusing')).toBeTruthy();
    });

    it('tapping a category submits the rating together with the reason code', () => {
        setStoreState();
        render(<NpsBanner />);
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        fireEvent.click(screen.getByText('Confusing'));
        expect(useAppStore.getState().submitNps).toHaveBeenCalledWith(2, 'confusing');
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/Feedback/__tests__/NpsBanner.test.tsx`
Expected: FAIL — clicking rating `2` currently calls `submitNps(2)` immediately instead of showing chips.

- [ ] **Step 4: Implement the chip UI in `NpsBanner.tsx`**

Replace the full file content with:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

const RATINGS = [1, 2, 3, 4, 5] as const;
const REASONS = ['missing_feature', 'bug', 'confusing', 'slow', 'other'] as const;
const STORE_URL = 'https://chromewebstore.google.com/detail/feildjaginpppijbpplcghalabdeibdb?utm_source=item-share-cb';

export function NpsBanner() {
    const { feedbackEligible, feedbackDismissed, submitNps, dismissFeedback } = useAppStore();
    const { t } = useTranslation();
    const [pendingRating, setPendingRating] = useState<number | null>(null);
    const [badRating, setBadRating] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    if (!feedbackEligible || feedbackDismissed) return null;

    const handleRating = (rating: number) => {
        if (rating >= 4) {
            setPendingRating(rating);
        } else {
            setBadRating(rating);
        }
    };

    const handleReasonSelect = (reason: string) => {
        submitNps(badRating!, reason);
        toast.success(t('feedback.npsThank'));
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(STORE_URL);
        setCopied(true);
        setTimeout(() => submitNps(pendingRating!), 2000);
    };

    const handleShareDismiss = () => {
        submitNps(pendingRating!);
    };

    if (pendingRating !== null) {
        return (
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">{t('feedback.sharePrompt')}</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="btn btn-xs btn-primary no-animation"
                        onClick={handleCopy}
                    >
                        {copied ? t('feedback.shareCopied') : t('feedback.shareCopy')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-xs btn-ghost opacity-50 hover:opacity-100 ml-1"
                        onClick={handleShareDismiss}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    }

    if (badRating !== null) {
        return (
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-primary">{t('feedback.reasonPrompt')}</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {REASONS.map((reason) => (
                        <button
                            key={reason}
                            type="button"
                            className="btn btn-xs btn-ghost text-base-content/70 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleReasonSelect(reason)}
                        >
                            {t(`feedback.reason.${reason}`)}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary">{t('feedback.npsQuestion')}</span>
            <div className="flex items-center gap-1">
                {RATINGS.map((rating) => (
                    <button
                        key={rating}
                        type="button"
                        className="btn btn-xs btn-ghost text-base-content/70 hover:text-primary hover:bg-primary/10"
                        onClick={() => handleRating(rating)}
                    >
                        {rating}
                    </button>
                ))}
                <button
                    type="button"
                    className="btn btn-xs btn-ghost opacity-50 hover:opacity-100 ml-1"
                    onClick={dismissFeedback}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/Feedback/__tests__/NpsBanner.test.tsx`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Run the full unit suite and typecheck to catch regressions**

Run: `npm run test:run && npm run typecheck`
Expected: both exit 0

- [ ] **Step 7: Commit**

```bash
git add src/components/Feedback/NpsBanner.tsx src/components/Feedback/__tests__/NpsBanner.test.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(feedback): prompt for a reason category on bad NPS ratings"
```

---

### Task 3: Supabase schema — `reason` column + updated RPC

**Files:**
- Create: `/Users/dominik-personal/Documents/reis-admin/supabase/migrations/20260703120000_add_feedback_reason.sql`

**Interfaces:**
- Consumes: nothing (pure SQL).
- Produces: `feedback_responses.reason` column (nullable, `text`, `CHECK` constraint on 5 values), updated `submit_feedback(p_student_id, p_faculty_id, p_study_semester, p_feedback_type, p_value, p_semester_code, p_reason text DEFAULT NULL)` RPC. Task 4 reads `reason` directly via `supabase-js` `.select('*')`.

- [ ] **Step 1: Write the migration file**

Create `/Users/dominik-personal/Documents/reis-admin/supabase/migrations/20260703120000_add_feedback_reason.sql`:

```sql
-- Bad-rating (NPS <= 3) reason tracking
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

- [ ] **Step 2: Commit the migration file**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add supabase/migrations/20260703120000_add_feedback_reason.sql
git commit -m "feat(feedback): add reason column and updated submit_feedback RPC"
```

- [ ] **Step 3: STOP — confirm with the user before applying to the live Supabase project**

This ALTERs a shared production table and replaces a `SECURITY DEFINER` RPC used by the live extension. Do not run it automatically. Ask the user to confirm, then apply it either:
- via the Supabase dashboard SQL editor (paste the migration body), or
- via the Supabase MCP `apply_migration` tool if connected to the correct project, or
- via `supabase db push` if the repo is CLI-linked to the project.

After applying, verify with a read-only check (e.g. `select column_name from information_schema.columns where table_name = 'feedback_responses';` should include `reason`) before proceeding to Task 4.

---

### Task 4: reis-admin — types + reason aggregation in `useFeedbackStats`

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/lib/database.types.ts` (`feedback_responses` table shape)
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/features/analytics/hooks/useFeedbackStats.ts`

**Interfaces:**
- Consumes: `feedback_responses.reason` column from Task 3 (must be applied to the live project before this hook is exercised against real data — typechecking/building does not require the live column to exist, only the type definition).
- Produces: `FeedbackStats.reasonBreakdown: { reason: string; label: string; count: number }[]` — consumed by Task 5's `AnalyticsView.tsx`.

- [ ] **Step 1: Add `reason` to the generated types**

In `/Users/dominik-personal/Documents/reis-admin/src/lib/database.types.ts`, in the `feedback_responses` block (around line 60), add `reason: string | null` to `Row`, and `reason?: string | null` to `Insert` and `Update`:

```ts
      feedback_responses: {
        Row: {
          id: string
          student_id: string
          faculty_id: string | null
          study_semester: number | null
          feedback_type: string
          value: string
          semester_code: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          faculty_id?: string | null
          study_semester?: number | null
          feedback_type: string
          value: string
          semester_code: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          faculty_id?: string | null
          study_semester?: number | null
          feedback_type?: string
          value?: string
          semester_code?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Extend `useFeedbackStats.ts` to aggregate reasons**

Replace the full file content of `/Users/dominik-personal/Documents/reis-admin/src/features/analytics/hooks/useFeedbackStats.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const REASON_LABELS: Record<string, string> = {
    missing_feature: 'Nemá to co potřebuji',
    bug: 'Nefunguje to',
    confusing: 'Nepřehledné',
    slow: 'Pomalé',
    other: 'Jiné',
};

interface FeedbackStats {
    npsDistribution: { rating: string; count: number }[];
    avgNps: number;
    totalResponses: number;
    semesters: string[];
    reasonBreakdown: { reason: string; label: string; count: number }[];
}

export function useFeedbackStats(semesterFilter?: string) {
    const [stats, setStats] = useState<FeedbackStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, [semesterFilter]);

    async function fetchStats() {
        setLoading(true);

        let query = supabase
            .from('feedback_responses')
            .select('*')
            .eq('feedback_type', 'nps');

        if (semesterFilter) query = query.eq('semester_code', semesterFilter);

        const { data: rows } = await query;
        if (!rows) { setLoading(false); return; }

        // NPS distribution (1-5)
        const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        let sum = 0;
        const reasonCounts: Record<string, number> = {};
        for (const r of rows) {
            const v = r.value;
            if (counts[v] !== undefined) {
                counts[v]++;
                sum += Number(v);
            }
            if (r.reason && REASON_LABELS[r.reason]) {
                reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
            }
        }

        const npsDistribution = Object.entries(counts).map(([rating, count]) => ({ rating, count }));
        const avgNps = rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : 0;
        const reasonBreakdown = Object.entries(reasonCounts)
            .map(([reason, count]) => ({ reason, label: REASON_LABELS[reason], count }))
            .sort((a, b) => b.count - a.count);

        // Get all semesters for filter
        const { data: allRows } = await supabase
            .from('feedback_responses')
            .select('semester_code')
            .eq('feedback_type', 'nps');

        const semesters = [...new Set((allRows ?? []).map(r => r.semester_code))].sort();

        setStats({ npsDistribution, avgNps, totalResponses: rows.length, semesters, reasonBreakdown });
        setLoading(false);
    }

    return { stats, loading };
}
```

- [ ] **Step 3: Typecheck reis-admin**

Run: `cd /Users/dominik-personal/Documents/reis-admin && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 4: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add src/lib/database.types.ts src/features/analytics/hooks/useFeedbackStats.ts
git commit -m "feat(analytics): aggregate bad-rating reason counts in useFeedbackStats"
```

---

### Task 5: reis-admin — render the reason breakdown in `AnalyticsView.tsx`

**Files:**
- Modify: `/Users/dominik-personal/Documents/reis-admin/src/features/analytics/AnalyticsView.tsx`

**Interfaces:**
- Consumes: `FeedbackStats.reasonBreakdown` from Task 4, existing `RatingBar({ rating: string; count: number; maxCount: number })` component defined at line 87 of this same file.
- Produces: nothing — terminal task.

- [ ] **Step 1: Add the reason-breakdown block to the Feedback section**

In `AnalyticsView.tsx`, inside the `<section>` with heading "Hodnocení uživatelů" (around lines 175-224), the current layout is a two-column grid (`grid md:grid-cols-2 gap-6`) with the distribution chart on the left and the average-score card on the right. Add a new block directly after the closing `</div>` of that grid (after line 224, before the `</section>` closing the Feedback section):

```tsx
                {(feedback?.reasonBreakdown?.length ?? 0) > 0 && (
                    <div className="bg-base-100 rounded-lg border border-base-300 p-5 mt-6">
                        <h3 className="text-sm font-semibold mb-4">Důvody špatného hodnocení</h3>
                        <div className="space-y-2">
                            {feedback!.reasonBreakdown.map(r => (
                                <RatingBar
                                    key={r.reason}
                                    rating={r.label}
                                    count={r.count}
                                    maxCount={Math.max(...feedback!.reasonBreakdown.map(x => x.count))}
                                />
                            ))}
                        </div>
                    </div>
                )}
```

- [ ] **Step 2: Verify it renders correctly**

Run: `cd /Users/dominik-personal/Documents/reis-admin && npm run dev`, open the Analytics view in a browser, confirm:
- With no `reason` data yet (pre-migration or no bad ratings submitted), the new block does not render at all (no empty card).
- Once bad-rating reasons exist in `feedback_responses`, the block appears under the existing rating distribution/average cards, listing each reason label with a proportional bar and count, respecting the existing semester filter.

Stop the dev server afterward.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/dominik-personal/Documents/reis-admin && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 4: Commit**

```bash
cd /Users/dominik-personal/Documents/reis-admin
git add src/features/analytics/AnalyticsView.tsx
git commit -m "feat(analytics): show bad-rating reason breakdown in the NPS section"
```
