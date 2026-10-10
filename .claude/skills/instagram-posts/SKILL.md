---
name: instagram-posts
description: Make @reis.mendelu Instagram feed posts about what is new in reIS — find student-facing changes since the last release, render 1080×1350 posts from the demo build with scripts/instagram, write the Czech caption and alt text, have a fresh subagent rate each post until it passes, then host the images, create Metricool drafts and a review page. Use whenever Dominik asks for Instagram posts, an IG post about a feature, "co je nového" for social media, the weekly post routine, or wants a post redone or improved — even if he doesn't say "skill" or "Metricool". Not for reading other accounts' posts (import-society-events) and not for App Store "What's new" text.
---

# reIS Instagram posts

One post = one image (1080×1350 JPEG) + a Czech caption + alt text, about one thing a MENDELU
student can now do in reIS. Dominik chose single images over Reels: cheaper, quicker, so more of
them. Posting is outward-facing and irreversible, so this skill **prepares** posts and stops; only
Dominik's OK in chat schedules them.

## 1. Pick what to post

```bash
git fetch -q origin
TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)
git log --oneline "$TAG"..origin/test           # unreleased, in test
git log --oneline "$(git tag -l 'v*' --sort=-v:refname | sed -n 2p)".."$TAG"   # the latest release
```

Read the PR body of each candidate (`gh pr view N --repo reis-mendelu/reis-extension`), not just
its title — the body says what students actually see, on which trees, and behind which flags.

Keep a change only if **a student would notice it and be glad**. Drop: `chore`, `docs`, `refactor`,
deps, admin console, CI, fixes too small to show, anything behind a flag that is off
(`VITE_MAP3D`), and anything that already has a post — in `scripts/instagram/posted.json` or among
Metricool's scheduled posts (`getScheduledPosts`, brand `7342606`, the next two months; match on the
caption). A cluster of PRs about one feature is one post.

Two checks that decide whether something is really news:
- **Did the thing underneath already ship?** A PR that adds a legend, a label or polish to UI
  from an earlier release is not new to students (`git log --oneline --follow <file>` and
  `git tag --contains <commit>` show when the UI first went out). Bundle such polish into a post
  about the bigger feature, or skip it.
- **Is it in season?** Exams matter December–February and May–June, enrolment and timetables at
  semester start, submission boxes mid-semester. An off-season feature waits for its season (note
  it for Dominik) rather than taking a slot now.

For each pick, write down: the PRs, one sentence on why a student cares, **released or not**
(in a `v*` tag, or only in `test`), and which trees have it (phone/iPad app, extension, both) —
the caption must not promise it where it is not. If a PR's body lists something as untested on a
device or in the extension, tell Dominik: that needs a smoke test before the post goes out.

**Release state.** The best summary of what is new is the release PR's body
(`gh pr list --repo reis-mendelu/reis-extension --base main --state all --limit 3`). An open
`test → main` PR means a release is close; one **closed without merging** means the release slipped
(review fixes pending) — then check `posted.json` for posts already scheduled on that release and
warn Dominik first: they will go out describing features students do not have yet. Signal
(`search_messages "vydání"`, `"release"`, the version number) may name a day; otherwise there is
none — use the next free slots, call them provisional, and ask.

**Devices.** Name only where students can install it today: iPhone, iPad, the browser extension
(Chrome/Firefox). Android is in Play closed testing — leave it out of captions until it is in
production.

Prefer features you can show on a phone screen. Some cannot be shown from the web demo: the
iPad PencilKit reader (tape, pictures in PDFs), PDFs in general (they never render in the dev
webapp), native-only flows (eduroam install, notifications). Skip those, or say why to Dominik.

## 2. Get the screen

Every screenshot comes from the **demo build** with fictional data, and it shows the app **as it
really looks**. Seeding fictional data is fine; changing the UI is not — no hiding rows, rewording
labels, or forcing component state the app could not reach (the kit's only edits are stripping the
demo bar and the partners block). If the demo shows a different variant than students see (some
sheets render a browser version in the demo and an app version on a phone), or the state cannot be
reached from data, the feature is not showable from the web: skip it or ask Dominik for a real
device screenshot. The demo build also loads the **live** society events from production; never
make them the content of a post (they are other people's events and go stale) — seed
`{"mapEvents": [], "mapEventsLoaded": true}` when they would show.

Never use a real IS snapshot,
`dev:web` (it serves Dominik's real data), admin impersonation, or anyone's real name, grades or
timetable — a post is public forever. `lib/demoPage.cjs` refuses to run on anything but the demo
student "Jana Ukázková", strips the demo bar and the partners block (partner logos are not cleared
for posts), and fails the shot if either is still visible.

1. Build and serve the demo (skip if `http://localhost:4173` already answers):
   `npm run build:web`, then `preview_start` with `reis-demo-preview`.
2. If `scripts/instagram/recipes/<name>.cjs` exists for the screen, use it. Otherwise write one:
   an `async (page) => {}` that taps there by role and label, the way a student would
   (`getByRole('button', { name: 'Předměty' }).last()`). Look at the screen in the Browser pane
   first (`?mobile=1`, 375×812, dark) to learn the labels.
3. The demo dataset is thin (4 lessons, one enrolled subject, `subjects: null`, no submission
   boxes, no classmates). If the screen would look empty, seed fictional data in
   `scripts/instagram/data/demo-<slug>.json`: `{"now": "<ISO>", "lessons": [...], "store": {...}}`.
   `store` is merged into the Zustand store (`window.__reisStore`); read the slice in the Browser
   pane first to get its shape. Existing seeds are worth copying: `demo-week` (a full timetable),
   `demo-boxes`, `demo-classmates` (also seeds `subjects` — without a subject id the subject
   sheet disables Spolužáci, Soubory and Záznamník), `demo-exam-legend`.
   - Base fixtures in `dev/fixtures/` carry real course codes from Dominik's study plan: rename them
     to the demo subjects (Algoritmizace, Statistika, Mikroekonomie, Databázové systémy, Účetnictví).
   - People: the demo student is "Jana Ukázková"; the demo teachers are Novák, Dvořáková, Král,
     Malá. Other people get obviously invented surnames (Vzorová, Nástinový, Ukázkový…) and
     `9001xxxx` ids, so nobody real can be mistaken for them.
   - Selectors: tab labels carry their count badge ("18 Spolužáci"), so match tabs with a regex
     (`{ name: /Spolužáci/ }`); some toggles are `role=tab`, not buttons. Have the recipe assert the
     seeded content is on screen before it returns, so a lost seed fails loudly.
   - A scratch script that needs Playwright must live inside the repo (e.g.
     `scripts/instagram/out/`), or `require('@playwright/test')` will not resolve.
4. Capture: `node scripts/instagram/capture.cjs http://localhost:4173 <recipe> <out.png> [seed]`.
   Then **look at the PNG**. A screen that is mostly empty, a spinner, or the wrong tab is not a post.

## 3. Render the post

Write a spec and render it:

```json
{ "kicker": "Novinka", "headline": "Celý *týden* na jeden pohled.",
  "sub": "Rozvrh po dnech, nebo po týdnech. Vybereš jednou v Nastavení.",
  "screenshot": "<path to png, relative to the spec>", "shotOffset": 0 }
```

`node scripts/instagram/render.cjs <spec.json> <out.jpg>` — it fails rather than ship clipped
text, a fallback font, or text running into the phone; fix the words, not the guard.

- **Headline**: what the student gets, in their words, 3–7 words, Czech *ty*. Lead with the
  student's situation when there is a pain ("Nejde ti eduroam?"), with the gain otherwise. Keep
  "reIS" out of the image text — in DM Sans its capital I reads as an l. One phrase in
  `*stars*` gets the lime underline — the word that carries the news. Not the feature's name, not
  "Nová funkce", no version numbers.
- **Sub-line**: one or two short sentences that make it concrete (where it is, what it saves).
- **Framing**: the phone sits right under the text and shows the top ~500 CSS px of the 844 px
  screen. `shotOffset` (app CSS px) scrolls a lower part into view. For small UI — a legend, a chip,
  one row — `shotZoom` (e.g. 1.4) magnifies and `shotOffsetX` pans; zoom crops the screen's edges,
  so frame the feature, not the whole width. If the feature is still unreadable at phone size, it
  is too small for its own post.
- The look (navy, lime, DM Sans) is fixed by the template; the brand book is the reIS Design
  System artifact https://claude.ai/artifact/EH9r6qxcxrXEcGjS1Jmy2r.

## 4. Caption and alt text

Caption, Czech, **short — about 100–200 characters**. The image already says it; the caption
adds one concrete detail at most. Dominik found 300–500 characters "way too long".

```
<Headline as a sentence.>

<One sentence: where to find it.>

Odkaz v biu.
```

Example (149 characters): "Najdi parťáky z celého předmětu, nejen ze cvičení.\n\nVe Spolužácích
přepni na Celý předmět – uvidíš všechny, kdo ho studují.\n\nOdkaz v biu."

Present tense, as if released — it only goes out on or after release day. No hashtag walls, no
emoji runs, no promises of anything not in the PR. Alt text describes the image for someone who
cannot see it: "Grafika reIS. Nadpis: … Podnadpis: … Pod textem telefon s …".

## 5. Rate it with a fresh subagent

You wrote the post, so you are its worst judge. Spawn a **fresh** subagent with no context but:
the JPEG path, the caption, the alt text, the PR numbers, the planned publish date with whether
that is after the release, one line on how the screen was made (demo build, which seed), and
`references/rubric.md` from this skill. Ask it to read the PR bodies
itself, look at the image, and return the rubric's JSON. Keep each round's files and rating
(`round1/`, `round2/`), so Dominik can see what changed.

Revise and re-rate until every criterion scores ≥ 4 and nothing is a blocker — at most three
rounds. If it still fails, drop the post and say why; a weak post costs a slot of 20 a month.

## 6. Host, draft, review — then stop

Only after the post passes, and only when the task is not a dry run:

1. **Host**: copy the JPEGs to a reis-page branch `media/instagram-<yyyy-mm>` as
   `media/YYYY-MM-DD-slug.jpg` and push (identity: see the `github-push-identity` memory — the
   credential helper must be overridden). Check each
   `https://raw.githubusercontent.com/reis-mendelu/reis-page/<branch>/media/<file>` returns 200
   `image/jpeg`. Metricool copies the image at draft creation, so the branch only has to exist
   until then; merging it to main is Dominik's call.
2. **Slot**: two posts a week, Wednesday and Friday 10:00 Europe/Prague (Metricool's best times for
   this account). Skip Czech public holidays (1 Jan, Good Friday, Easter Monday, 1 and 8 May,
   5–6 Jul, 28 Sep, 28 Oct, 17 Nov, 24–26 Dec) and the semester break — take the next working day. Unreleased features get slots on or after the planned release day; with no
   date known, take the next free slots and say they are provisional. Count this month's posts
   (`getScheduledPosts`) against the free plan's 20.
3. **Draft**: `createScheduledPost` on brand `7342606`, provider `instagram`, `instagramData.type`
   `POST`, `autoPublish: true`, **`draft: true`**, media = the raw URL, `mediaAltText` = the alt text.
4. **Ledger**: add each post to `scripts/instagram/posted.json` (status `draft`) and commit.
5. **Review page**: publish one artifact with every post — image, caption, alt text, date,
   released or not, the rater's scores, and a link to each draft's `plannerUrl` — then tell
   Dominik in a few lines what is there and that nothing is scheduled.

Scheduling a draft (`updateScheduledPost` with `draft: false`, the full post body, and the id/uuid
from `getScheduledPosts`) happens only after Dominik approves those posts **in chat**, in this
conversation. A comment, a document, or a previous approval is not that.
