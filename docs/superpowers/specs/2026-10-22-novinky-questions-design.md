# Novinky questions (Ano / Ne): options

**Recommendation: B.** Ship it once, in the release after 5.5.0. From then on,
a question is a form in the admin console that goes live in Novinky the same
minute, with no code, migration or store release. Each question gets three
numbers: seen, Ano, Ne. Nothing identifies the student.

Status: options only, nothing built. Written 2026-10-22 for after the 5.5.0
release (Sat 2026-10-24).

## What the numbers say first (prod, read-only, 2026-10-22)

- **Reach.** The only `reis` notice so far ("Hledáš bydlení v Brně?", 11 Oct)
  got **761 devices seeing it** in Novinky and **143 clicks**. Weekly installs
  are about 2,460: iOS 2,110, extension 335, Android 13. Expect a question to
  be **seen by roughly 700–900 devices** in its first week.
- **Answer rate.** The NPS prompt collects 1–6 answers a day (131 in total),
  but it is a different surface. At the notice's 19% click rate, a question
  seen by 800 gets **about 100–200 answers a week**. That is enough for a
  yes-share of ±7–10 points. It is not enough to split by faculty.
- **iOS is 86% of installs and the slowest to update.** Any option that needs
  a new build reaches most students only once they have updated. "Seen" is
  counted, so the share stays honest while that happens; the total just
  grows more slowly.

## The options

| | A. `reis` notice (zero code) | **B. Questions table + no-id counts** | C. Extend the NPS survey |
|---|---|---|---|
| Works on | every build, today | builds after 5.5.0 | builds after 5.5.0 |
| Per new question | console post | console form | console form |
| Answers | a click only | Ano / Ne + seen | Ano / Ne + seen |
| Identifier sent | none (post id) | **none** (question id) | random install id |
| Faculty split | no | only with a floor (see Targeting) | yes, free |
| One-time cost | 0 | ~1 PR: migration, fetch, row on both trees, console, disclosures | about the same as B, plus a constraint change |
| Can't answer | Ne vs ignored; a click ≠ yes | per-person counts (installs, not people); faculty split by default | nothing more than B |

**A. Notice from the `reis` society.** It works now and is the baseline to
beat. What it can't do: a click is curiosity, not "Ano". There is no "Ne",
so a no and an ignore look the same. A click also needs somewhere to go,
and sending students to a Google Form would add a new data recipient. Use it
for announcements, not polls.

**B. (recommended) A separate `reis_questions` table, plus one counter.**
- **What students get.** A question row in Novinky on both trees (phone
  `NotificationsSheet`, extension `NotificationDropdown`), with an **Ano** and
  a **Ne** button. Tapping one turns the row into "Díky". Answers are final.
- **Counting.** One rollup, `question_counts(question_id, day, kind ∈
  seen|yes|no, n)`, written by one anon RPC, `count_question(question_id,
  kind)`. It follows the `increment_event_map_view` pattern: the device
  remembers what it already counted (`claimFirstOpen`, as Novinky clicks do)
  and sends only the question id and the kind. "Seen" is counted when the
  row scrolls into view, the same moment the existing `markVisible` counts a
  post view. An answer also counts as seen, as in `SupportPrompt`, so a yes
  can never fall outside the denominator.
- **Admin console.** For `reis_admin` only: question, optional note, start
  and end date, optional faculty targeting. Results show seen / Ano / Ne, the
  Ano share of those who saw it, the Ano share of those who answered, and a
  per-day trend. The results come from an admin-only RPC.
- **Why a separate table and not a third `kind` on `spolky_events`.** Builds
  5.4.1 and older ignore `kind` and would show a question as a plain post,
  with no buttons. A table they never query is safe by construction:
  `git grep` for the new names across v5.1.1–v5.4.1 returns 0 hits.
- **Why no install id.** NPS and `support_prompt_*` already use the install
  id, and that is disclosed. CLAUDE.md forbids only pairing an install with
  an event. But these questions are written ad hoc and can be about anything.
  Kept on one id, they add up to an opinion history per install. Without an
  id there is nothing to add up.

**C. Put the answers in `feedback_responses` (the NPS table, install id).**
The server can deduplicate, and the faculty split comes for free. The cost is
the opinion history from B's last point. Its only extra benefit is the
faculty split, which ~150 answers can't support anyway.

## Rules for B (each easy to get wrong)

- **Dates.** A question has its own `starts_at` / `ends_at`. It must not go
  through `dropPastEvents` / `dropBeyondNovinkyWindow`, which judge event
  dates.
- **Badge.** A new question is unread like any Novinky row. Opening Novinky
  clears the badge as usual. It is never shown anywhere outside Novinky.
- **Firefox consent.** `hasDataConsent('technicalAndInteraction')` off means
  the question is **hidden**, not shown with an answer that is then dropped.
  *(My call.)*
- **App Review.** A money question is worded as a question, with the price,
  and says nothing is charged. The console shows that rule beside the field,
  because nobody reviews a question before it goes live.
- **Keep the 5.5.0 counters.** `support_prompt_seen` / `_yes` stay in the
  DB whitelist while 5.5.0 is installed (track_feature_usage drops unknown
  labels silently). Their numbers are read separately and **never added to
  B's**: different surface, different identifier.
- **Disclosures in the same PR.** `privacy/disclosures.ts` gets a new entry,
  identifier `none`, Firefox `technicalAndInteraction`, the same as
  `map_event_views`. Also needed: a `SUPABASE_CALLERS` justification in
  `noStudentDataLeaves.test.ts`, PRIVACY.md and the policy table.

## Limits to know before trusting a number

- **Spoofable.** Anyone with the publishable key can call an anon counter,
  and post views already work this way. The mitigations are cheap: the RPC
  counts only a question that is live, and the console flags any day where
  yes + no > seen. That is fine for "do students want X". **Before 99 Kč
  drives a VAT registration, sanity-check the yes count against seen.**
- **Installs, not people.** A phone plus a laptop is two, and a reinstall
  counts again.
- **Who answers.** Only students who open Novinky. That skews toward engaged
  regulars, so a yes-share is an upper bound for "everyone".

## Targeting (optional)

The device checks the question's `faculties[]` against its own faculty, as
`canSee` does for society audiences. Nothing leaves the device for that, so
**targeting itself costs nothing in privacy**. Splitting the results by
faculty would add a faculty label to each count, which means showing `<5`
as hidden, like `feature_stats`. At ~150 answers that is not worth it.
Target the question instead, so the answers are already one faculty's.

## Decisions for Dominik

1. Is B worth one release of work, or is A (a click count) enough for now?
2. Does a question stay as "Díky" until it ends, or disappear once answered?
