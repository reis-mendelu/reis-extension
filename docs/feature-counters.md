# Counting what a student opens or clicks

The rule is in CLAUDE.md ("Count what you ship"): when you add something a
student can open or click, ask whether anyone will later need the number,
especially a partner (EY's "Cesta s EY" in Stáže is the worked example, #721).

## Steps

1. A label in `FEATURE_SIGNALS` (`src/api/featureUsage.ts`): `screen_*` when a
   surface is shown (`useScreenSignal`), a plain verb label for a click or use
   (`trackFeatureSignal` in the handler). It counts **installs, not people**,
   once per app session, one row per install per day.
2. A migration widening the database whitelist, in the function **and** the
   column check. `featureSignalWhitelist.test.ts` fails if either disagrees with
   the client, and an unknown label is dropped silently, so apply the migration
   before the build that sends the label ships.
3. Both trees: put the call in the shared component (as `InternshipList` does),
   or pin both call sites in `screenSignalsHaveBothTrees.test.ts`.
4. Declare it in `privacy/disclosures.ts` (`feature_counters`), then
   `npm run privacy:generate`, and give it an admin label
   (`featureSignalLabels.ts` plus `admin.stats.*` in cs and en).

## Rules

- **One label per partner programme**, never a shared one, because the count is
  given to that partner.
- Never record *which* student. A counter carries the random install id and
  nothing else: no event, partner-side or student identifier beyond it, so the
  only join is the one the policy already discloses (install id to the daily
  row's faculty, programme, platform and version labels). The partner is told a
  number, never a row.
- Clicks: count the primary click and a middle-click (`button === 1`), never a
  right-click, which only opens the context menu.
- The admin panel shows "under 5" for a count below its floor, so a young
  counter looks empty; that is the floor, not a bug.
