# Novinky questions: options to decide together

**My lean: one shape for every kind.** A question is a short prompt plus
**up to five buttons**, written in the admin console and live in Novinky the
same minute. Each button is either an answer (counted) or a link (counted
and opened). Ano/Ne, 👍/👎, 1–5 and "Otevřít reByt" are then the same
feature with different buttons. Counting sends the question id and the button
only, no identifier. It ships once, in the release after 5.5.0. Nothing is
decided until we have been through the questions at the end.

Status: partly decided, nothing built. Written 2026-10-22. The 99 Kč question
ships in 5.5.0 (Sat 2026-10-24) on the existing counters. This replaces that
mechanism afterwards.

**Decided by Dominik (2026-10-22):**
- **Build it as described in "How it works" below**: a separate
  `reis_questions` table and a counter that sends no identifier. It was
  option B in the first draft.
- **When:** after 5.5.0 is released, as its own PR against `test`.
- **After answering**, the row stays as "Díky" until the question ends.

Decisions 1–3 below are still open.

## The three kinds Dominik named

| Kind | Example | Buttons | What we read |
|---|---|---|---|
| Willingness to pay | "Podpořil(a) bys reIS 99 Kč?" | Ano · Ne | Ano / seen |
| Satisfaction | "Jak jsi spokojen(a) s reIS?" | 👍 · 👎, or 1–5 | the split of answers |
| Promotion | "reByt: bydlení pro studenty" | Otevřít reByt | clicks / seen |

## What the numbers say first (prod, read-only, 2026-10-22)

- **Reach.** The only `reis` notice so far ("Hledáš bydlení v Brně?", 11 Oct)
  was seen on **761 devices** in Novinky and clicked **143** times (19%).
  Weekly installs are about 2,460: iOS 2,110, extension 335, Android 13.
  Expect a question to be seen by about **700–900 devices in its first
  week**.
- **Answers.** At that click rate, expect **about 100–200 answers a week**.
  For a yes/no that gives a yes-share within ±7–10 points. At 1–5 it is only
  20–40 answers per value, so the scale buys little precision.
- **Donation go/no-go (agreed today):** ≥5% yes among installs that saw it,
  over 4 weeks from 5.5.0. It is measured on 5.5.0's `support_prompt_*`
  counters, not on this design. With ~800+ seen, 5% is ~40 yes, and the
  answer is clear to about ±1.5 points.
- **iOS is 86% of installs and the slowest to update.** Whatever ships after
  5.5.0 reaches most students only once they have updated. "Seen" is counted,
  so the shares stay honest; the totals just grow more slowly.

## Decision 1: how general is a question?

| | **(i) Buttons list** (my lean) | (ii) Ano/Ne only | (iii) A type per kind |
|---|---|---|---|
| Covers all three kinds | yes | pay only; reByt stays a notice | yes |
| Console | pick a preset (Ano/Ne, 👍/👎, 1–5, Odkaz), edit labels | one text field | one form per type |
| Code | one row, one counter | smallest | three rows, three counters |
| Risk | a 5-button row has to fit 320px (the extension popup) | none | three things to keep on both trees |

**(i)** stores `buttons: [{key, label_cz, label_en, url?}]` on the question.
The counter accepts only a key that the question has, plus `seen`.
"Otevřít reByt" is a button with a `url`: it is counted, then opened.
Compared with (ii), the extra cost is the presets in the console and a check
of the 1–5 row at 320px.

## Decision 2: satisfaction, which of these?

reIS already asks for satisfaction: the NPS prompt asks for a 1–5 rating and
a reason once per semester, on the install id. It has 131 answers since
March; 88 of them are a 5.

- **(a) Keep the NPS prompt as the satisfaction number** and use Novinky
  only for specific questions ("Chceš X?"). That avoids two satisfaction
  numbers that disagree. *(My lean.)*
- **(b) 👍/👎 in Novinky.** It is quicker to answer and costs the same as
  Ano/Ne, but it duplicates NPS with a cruder scale.
- **(c) 1–5 in Novinky.** It is the same scale as NPS on a second surface,
  and its answers per value are too few to read.

## Decision 3: reByt now or later?

A `reis` notice with a reByt link **works on every build today**, and its
views and clicks are already counted per device. That is all a promotion
needs. A link button in the new feature adds start and end dates, a
"Nezajímá mě" button, and the same results card as everything else. Nothing
gets measured that a notice can't measure. **Lean:** post reByt as a notice
now, and move it into questions only if (i) ships.

## How it works (whichever of the above)

- **A separate `reis_questions` table, not a third `kind` on
  `spolky_events`.** Builds 5.4.1 and older ignore `kind` and would show a
  question as a plain post with no buttons. A table they never query is safe
  by construction: `git grep` for the new names across v5.1.1–v5.4.1 returns
  0 hits.
- **One counter.** `question_counts(question_id, day, key, n)` is written by
  one anon RPC, `count_question(question_id, key)`. This is the
  `increment_event_map_view` pattern: the device remembers what it already
  counted (`claimFirstOpen`) and sends only the question id and the key.
  "Seen" is counted when the row scrolls into view, the same moment
  `markVisible` counts a post view today. An answer also counts as seen, as
  in `SupportPrompt`, so no answer falls outside the denominator.
- **Both trees.** The row shows on the phone (`NotificationsSheet`) and in the
  extension (`NotificationDropdown`). After a tap the row turns into "Díky"
  and stays that way until the question's `ends_at` (decided). An answer is
  final.
- **Admin console** (`reis_admin` only). Fields: prompt, optional note, a
  buttons preset, Czech **and** English labels, start and end date, optional
  faculties. Results show seen, the count per button, each button's share of
  seen and of answered, and a per-day trend.
- **Why no install id.** NPS and `support_prompt_*` already use the install
  id, and that is disclosed. CLAUDE.md forbids only pairing an install with
  an event. But these questions are written ad hoc and can be about
  anything. Kept on one id, they add up to an opinion history per install.
  Without an id there is nothing to add up. The cost is that the server
  can't remove duplicates, so a reinstall counts again.

## Rules (each easy to get wrong)

- **Dates.** A question has its own `starts_at` / `ends_at`. It must not go
  through `dropPastEvents` / `dropBeyondNovinkyWindow`, which judge event
  dates.
- **Badge.** A new question is unread like any Novinky row, and opening
  Novinky clears the badge as usual. It is never shown outside Novinky.
- **Firefox consent.** When `hasDataConsent('technicalAndInteraction')` is
  off, the question is **hidden**. It is not shown with an answer that then
  gets dropped. *(My call.)*
- **App Review.** A money question is worded as a question, with the price,
  and says nothing is charged. A link to another app (reByt) opens its store
  page or website. The console shows these rules next to the fields, because
  nobody reviews a question before it goes live.
- **Keep the 5.5.0 counters.** `support_prompt_seen` and `support_prompt_yes`
  stay in the DB whitelist while 5.5.0 is installed, because
  `track_feature_usage` drops unknown labels silently. Their numbers are
  **never added to these**: different surface, different identifier.
- **Disclosures in the same PR.** Add a `privacy/disclosures.ts` entry with
  identifier `none` and Firefox `technicalAndInteraction`, as for
  `map_event_views`. Also add a `SUPABASE_CALLERS` justification in
  `noStudentDataLeaves.test.ts`, and update PRIVACY.md and the policy table.

## Limits to know before trusting a number

- **Spoofable.** Anyone with the publishable key can call an anon counter;
  post views already work this way. The cheap mitigations: the RPC counts
  only a question that is live and a key it has, and the console flags any
  day where answers > seen.
- **Installs, not people.** A phone plus a laptop is two.
- **Who answers.** Only students who open Novinky, which skews toward engaged
  regulars. A yes-share is an upper bound for "everyone".

## Targeting (optional)

The device checks the question's `faculties[]` against its own faculty, as
`canSee` does for society audiences. Nothing leaves the device for that, so
**targeting costs nothing in privacy**. Splitting results by faculty would
put a faculty label on each count, with `<5` hidden as in `feature_stats`.
At 100–200 answers that is not worth it; target the question instead.

## To decide together

1. **Shape:** a buttons list (i), Ano/Ne only (ii), or a type per kind (iii)?
2. **Satisfaction:** keep NPS (a), 👍/👎 in Novinky (b), or 1–5 in Novinky (c)?
3. **reByt:** a notice now, or wait for the link button?
4. ~~**After answering:** does the row stay as "Díky" until it ends, or
   disappear?~~ **Decided 2026-10-22:** it stays as "Díky" until the question
   ends.
