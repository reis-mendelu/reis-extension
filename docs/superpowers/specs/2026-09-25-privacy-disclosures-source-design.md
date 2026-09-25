# One source for privacy disclosures, enforced at every PR and every release

Date: 2026-09-25. Approved with Dominik, section by section.

## Why

A data flow is described in about ten places: the gist, `PRIVACY.md`, the app
policy, the App Store privacy label, Play Data safety, the Chrome Web Store
privacy practices, the Firefox manifest, iOS `Info.plist`, `CLAUDE.md` and
`noStudentDataLeaves.test.ts`. Nothing links them, so each change is
remembered by hand. The policy has drifted at least five times (see memory
`privacy-policy-gist`). Report attachments (#435/#438) needed eight of the ten
updated.

## Decisions

- **One source file, enforced** (not a checklist alone, not a Claude-only hook).
- **The release is blocked** until the disclosures are live (not a warning).
- **Claude does every disclosure step itself**, including Chrome MCP, without
  asking (memory `claude-does-store-disclosures`). Only signing in and the
  Chrome Web Store dashboard go back to Dominik: Chrome blocks every extension
  from scripting `chrome.google.com/webstore`, and the Browser pane refuses to
  load it.

## 1. The source

`privacy/disclosures.yaml`:

```yaml
flows:
  - id: daily_count
    what: One row per install per day — random install id, faculty, platform.
    when: background            # background | student-action
    identifier: install_id      # install_id | none | contact
    code:
      files: [src/api/feedback.ts]
      rpcs: [track_daily_usage]
    stores:
      apple:   [{ type: User ID, purpose: Analytics, linked: true, tracking: false }]
      play:    [User IDs]
      firefox: [technicalAndInteraction]
      cws:     [User activity]
exempt:                         # Supabase calls that are not a student data flow
  - rpc: get_event_rsvps
    why: Reads public counts; sends event ids only.
platform_permissions:
  ios:     [NSCameraUsageDescription]
  android: [INTERNET, POST_NOTIFICATIONS, ACCESS_WIFI_STATE, CHANGE_WIFI_STATE]
```

Flows at the start: daily count, NPS, feature counters, map-event views,
society post views/clicks, RSVP, feedback/report text + contact, report
attachments. Admin-console calls through `adminAuthClient` (a signed-in admin
or society, not a student) are outside `flows` and listed under `exempt`, each
with a reason.

Beside it:

- `privacy/play-data-safety.csv` — Play's own export format, exported from the
  console at bootstrap and pushed as-is.
- `docs/privacy-policy-app.md`'s "What we do send" table is generated from the
  flows between `<!-- BEGIN generated:flows -->` / `<!-- END generated:flows -->`.
  A flow's `policy:` text is the row.

## 2. `privacy:check` — every PR

`scripts/privacy/check.ts`, run as `scripts/lib/__tests__/privacyDisclosures.test.ts`
inside the required *Unit tests* job. It fails when:

1. a `supabase.rpc('<name>'` / `supabase.from('<table>')` in `src/` is not on a
   flow or in `exempt`, or a listed name no longer appears in `src/`
2. `SUPABASE_CALLERS` in `noStudentDataLeaves.test.ts` and the union of the
   flows' `code.files` disagree
3. `wxt.config.ts` Firefox `data_collection_permissions.optional` is not exactly
   the union of `stores.firefox`
4. `ios/App/App/Info.plist` `NS*UsageDescription` keys or
   `android/app/src/main/AndroidManifest.xml` `uses-permission` names differ
   from `platform_permissions`
5. the generated policy table is stale (`npm run privacy:generate` fixes it)
6. a `stores.play` type is not declared TRUE in the CSV, or a data type is
   declared TRUE in the CSV that no flow names

## 3. The release

**Generated checklist.** `release-checklist.yml` also runs
`scripts/privacy/diff.ts <last v* tag> <head>`. For each store whose declarations
changed since the tag, it appends one item with the exact values. Nothing
changed means one line saying so. Items carry an owner:

```text
### Privacy disclosures — changed since v5.2.5
- [ ] Gist matches docs/privacy-policy-app.md (CI checks this)
- [ ] Play Data safety pushed — `npm run privacy:publish` (Claude)
- [ ] App Store: + Photos or Videos — App Functionality, linked, not tracking (Claude, Chrome MCP)
- [ ] Chrome Web Store: + Website content (Dominik — Chrome blocks automation)
```

**`/release` gains a step before the merge:** `npm run privacy:publish`, then
Claude does the App Store items in Chrome and ticks them, then Claude gives
Dominik the Chrome Web Store ticks.

**`privacy:publish`** (`scripts/privacy/publish.ts`):
- republishes the gist from `docs/privacy-policy-app.md` via `gh` as
  ElijaahInverted, then switches back, and reads the gist back to confirm
- runs `gh workflow run play-data-safety.yml --ref <branch>` and waits for it
- prints what it did

**Release gate** (`release-gate.yml`, the required check) additionally fails
when:
- the public gist's `privacy.md` differs from `docs/privacy-policy-app.md` at
  the head SHA (a trailing newline is ignored). It is fetched without a token.
- any item in the generated privacy block is unticked. `edited` is already a
  trigger, so ticking the last box re-runs it.

Order enforced: disclosure live → merge → tag → builds.

## 4. Play API

- No new credential. The Chrome Web Store's existing Google Cloud service
  account (`CHROME_SERVICE_ACCOUNT_*` secrets) is invited in Play Console →
  Users and permissions, with this app only and the permission Data safety
  needs. Claude finds its email in Google Cloud (read-only) and sends the
  invite through Chrome.
- `.github/workflows/play-data-safety.yml` (`workflow_dispatch`): mints an
  OAuth token from those secrets (scope `androidpublisher`) and POSTs
  `{"safetyLabels": <csv>}` to
  `androidpublisher/v3/applications/cz.reis.app/dataSafety`.
- First run: Claude checks Play Console → Publishing overview for whether an
  API write still needs **Send for review**, does it if so, and records the
  answer in the release command and memory.

## 5. Claude Stop hook

`.claude/hooks/disclosure-drift.mjs`, registered next to `tree-parity.mjs`:
if the turn's changed files include a data-flow file (any flow's `code.files`,
`supabase/migrations/**`, `wxt.config.ts`, `Info.plist`, `AndroidManifest.xml`,
`src/test/guards/noStudentDataLeaves.test.ts`) and not
`privacy/disclosures.yaml`, block once per distinct file set, naming the files.
Answering "not a data-flow change" ends the turn, as with tree-parity.

## Bootstrap (same PR)

- Export the live Play CSV through Chrome, commit it.
- Write the YAML from today's verified state: Apple's 6 types, Play's types,
  CWS's two, Firefox's four, the iOS camera key, the Android permissions.
- Generate the policy table. Publish the gist if the generated text differs
  from what is live.
- Update `.claude/commands/release.md`, `.github/release-checklist.md` and a
  short "Privacy disclosures" pointer in `CLAUDE.md`.

## Testing

- unit tests: the checker (each of the six failures), `diff.ts`, the checklist
  generator, the policy table generator, the gist comparison
- negative control: a throwaway branch with a stray `supabase.rpc('x')` must
  fail CI's *Unit tests*
- the hook, the same way `tree-parity` is tested
- the Play workflow run for real once, with the result read back in Play Console
