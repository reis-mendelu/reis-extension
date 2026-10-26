# Privacy disclosures source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One typed source of every reIS data flow, checked on every PR, turned into a blocking, generated checklist on every release, with the gist and Play Data safety pushed by script.

**Architecture:** `privacy/disclosures.ts` holds the flows. `scripts/privacy/*.ts` holds pure functions: check, policy-table generation, store diff, checklist rendering and gist comparison. Each is unit-tested, and one repo-level test runs the checker against the real tree inside the required *Unit tests* job. Workflows call the same functions through `tsx`. A Stop hook mirrors `tree-parity.mjs`.

**Tech Stack:** TypeScript (tsx), vitest, GitHub Actions, `gh`, Google Play Developer API v3.

**Spec:** `docs/superpowers/specs/2026-09-25-privacy-disclosures-source-design.md`. One deviation, decided while planning: the source is **`privacy/disclosures.ts`**, a typed module, not YAML. `js-yaml` is only an indirect dependency here, and a `.ts` file is type-checked and keeps comments.

## Global Constraints

- Play data-type ids are the CSV's `PSL_DATA_TYPES_*` response ids, as exported on 2026-09-25: `PSL_EMAIL`, `PSL_USER_ACCOUNT`, `PSL_OTHER_MESSAGES`, `PSL_PHOTOS`, `PSL_CRASH_LOGS`, `PSL_PERFORMANCE_DIAGNOSTICS`.
- Apple types live on 2026-09-25: User ID (Analytics, linked), Email Address, Customer Support, Photos or Videos, Other Diagnostic Data (all App Functionality, linked), Crash Data (App Functionality, not linked). None are used for tracking.
- CWS: User activity, Website content. PII on CWS is unverified, so it is listed and becomes a first-release check.
- Firefox optional: `technicalAndInteraction`, `personalCommunications`, `personallyIdentifyingInfo`, `websiteContent`.
- No new runtime dependency. Files ≤ ~200 lines.
- Gist compare ignores one trailing newline.

---

### Task 1: The source and its types

**Files:** Create `privacy/disclosures.ts`, `privacy/play-data-safety.csv` (the export, verbatim).

**Produces:**
```ts
export interface AppleType { type: string; purpose: string; linked: boolean; tracking: false }
export interface Flow { id: string; what: string; when: 'background' | 'student-action'; identifier: 'install_id' | 'none' | 'contact';
  files: string[]; calls: string[]; policyRows: Array<[what: string, when: string, carries: string]>;
  stores: { apple: AppleType[]; play: string[]; firefox: string[]; cws: string[] } }
export interface Exempt { call: string; files: string[]; why: string }
export const FLOWS: Flow[]; export const EXEMPT: Exempt[];
export const PLATFORM_PERMISSIONS: { ios: string[]; android: string[] };
```
Flows: `daily_count`, `report` (text + contact), `report_attachments`, `survey_and_rsvp`, `society_post_counters`, `map_event_views`, `feature_counters`. Exempt: `get_event_rsvps`, `usage_stats`, `feature_stats`, `suggestions`, `suggestion_attachments`, `spolky_events`, `spolky_accounts`. `policyRows` are the current policy table rows, verbatim.

### Task 2: Checker

**Files:** Create `scripts/privacy/check.ts`, `scripts/privacy/__tests__/check.test.ts`.

**Produces:** `export function checkDisclosures(input: RepoSnapshot, model: Model): string[]` (the findings). `RepoSnapshot = { srcFiles: Record<path,string>; supabaseCallers: string[]; firefoxOptional: string[]; iosUsageKeys: string[]; androidPermissions: string[]; policyMd: string; playCsv: string }`, plus `readRepoSnapshot(root)`.

It checks the six spec rules. The call scan is `/\b(?:supabase|adminAuthClient)\s*\.\s*(?:rpc|from)\(\s*'([a-z0-9_]+)'/` on source text with newlines collapsed after `.`. It covers `.from(\n'x')`, as used in suggestionsAdmin.

- [ ] Tests: each rule fails on a crafted snapshot and passes on a clean one.

### Task 3: Policy table generator

**Files:** Create `scripts/privacy/policyTable.ts`, test. Modify `docs/privacy-policy-app.md` (add markers). Add `scripts/privacy/generate.ts` and an npm `privacy:generate` script.

**Produces:** `renderPolicyTable(flows): string` and `replaceGenerated(md, table): string`, which throws if the markers are missing.

- [ ] The generated table equals the current table byte for byte at bootstrap, so the gist doesn't change.

### Task 4: Repo test

**Files:** Create `scripts/lib/__tests__/privacyDisclosures.test.ts`. It runs `checkDisclosures(readRepoSnapshot(ROOT), model)` and expects `[]`, with the findings in the failure message.

### Task 5: Store diff and checklist

**Files:** Create `scripts/privacy/diff.ts` and `scripts/privacy/checklist.ts` with tests, plus `scripts/privacy/checklist-cli.ts`, which prints markdown for `<base ref> <head ref>` by loading `privacy/disclosures.ts` at each ref through `git show` into a temp file and importing it.

**Produces:**
- `diffStores(before: Model | null, after: Model): StoreDiff`. `null` means no baseline: every store is listed for a full audit.
- `renderChecklist(diff, sinceTag): string`, with markers `<!-- BEGIN privacy-disclosures -->` / `<!-- END privacy-disclosures -->`.
- `uncheckedItems(prBody): string[]`.

### Task 6: Gist compare + publish

**Files:** Create `scripts/privacy/gist.ts` (`sameContent(a,b)`, test), `scripts/privacy/publish.ts` (gist PATCH as ElijaahInverted and read-back, then `gh workflow run play-data-safety.yml` and watch it), npm `privacy:publish`.

### Task 7: Workflows

**Files:**
- Create `.github/workflows/play-data-safety.yml`.
- Modify `release-checklist.yml`: `npm ci`, run the checklist CLI against the last `v*` tag, and append the block.
- Modify `release-gate.yml`: add steps for the gist compare and the unticked-items check.

### Task 8: Stop hook

**Files:** Create `.claude/hooks/disclosure-drift.mjs` (exported `dataFlowFiles(changed, flowFiles)` and `buildReason`) and `src/test/guards/disclosureDriftHookSees.test.ts`. Modify `.claude/settings.json`.

### Task 9: Docs + negative control

**Files:** Modify `.claude/commands/release.md`, `.github/release-checklist.md` and `CLAUDE.md`.

- [ ] Negative control: add a stray `supabase.rpc('zz_probe')` to a scratch copy of the snapshot in a test, which must fail. Also do it once on a real branch and confirm CI *Unit tests* fails.

### Task 10: Play service account + first push

- [ ] Find the Chrome Web Store service account email in Google Cloud, through Chrome.
- [ ] Invite it in Play Console, scoped to this app, with Data safety rights.
- [ ] Dispatch `play-data-safety.yml` and check the result in Play Console.
