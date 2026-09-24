---
description: Map of the sibling reis-mendelu repos and the scraper → reis-data → CDN pipeline. Use for scraped data, CDN data shapes, or a new IS Mendelu scraper.
---

# /repos

Orientation for the reis-mendelu repos that take part in the data pipeline. Use this when a task touches scraped data, the CDN data pipeline, or requires building a new IS Mendelu scraper.

## Repo Map

The repos are siblings of the **main** `reis-extension` checkout. Every `../` below is relative to that checkout. From a worktree, resolve a sibling as `"$(git rev-parse --path-format=absolute --git-common-dir)/../../<repo>"`.

| Repo | Path | Role |
|------|------|------|
| **reis-extension** | `../reis-extension` | The extension, iOS and Android apps (one codebase) — consumes CDN data and Supabase at runtime |
| **reis-scraper** | `../reis-scraper` | Playwright scraper — logs into IS Mendelu with real credentials, crawls data |
| **reis-data** | `../reis-data` | Static file CDN — pre-crawled subject difficulty JSON served via jsDelivr |

`../reis-page` (the static landing page) is the fourth sibling and has no part in the pipeline.

## Pipeline: subject difficulty data

```
reis-scraper (crawl IS Mendelu) → SQLite db → export → reis-data (JSON files) → jsDelivr CDN → reis-extension (runtime fetch)
```

- Extension fetches from `https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main`
- Implemented in `src/api/successRate.ts` and `src/api/erasmus.ts`
- Success rates cached 30 days in IndexedDB; Erasmus 7 days

## Pipeline: notifications (separate)

The extension reads/writes notification data directly to **Supabase** — this has nothing to do with reis-scraper or reis-data.

## reis-data data contract

**`/subjects/<COURSE_CODE>.json`** — 4 041 courses:
```ts
{
  courseCode: string,
  stats: [{
    semesterName: string, semesterId: string, year: number, type: string,
    sourceUrl: string, totalPass: number, totalFail: number,
    terms: [{ term: string, grades: { A,B,C,D,E,F,FN: number }, pass: number, fail: number }]
  }]
}
```

**`/meta.json`** — `{ lastUpdated, courseCount, courseCodes[] }` — CDN health check used by the extension.

**`/erasmus/country-<id>-study.json`** — per-country Erasmus listings.

## reis-scraper capabilities

Authenticates to IS Mendelu via Playwright SSO (`.env` → `MENDELU_USER` / `MENDELU_PASS`). Has scripts for:

- Course success rates (grade distributions per semester/term)
- Study programs and subject trees
- Erasmus statistics
- Menza menus, harmonogram, ISKAM data
- Classmates, teacher profiles, study progress
- Syllabus scraping, internship listings

When building a new IS Mendelu scraper, read `../reis-scraper/scripts/` for existing patterns first — they are the canonical reference for IS Mendelu HTML structure.

## How to run scraper tasks

Scraper work runs in `../reis-scraper`, modelled on the closest existing script in `scripts/`, and crawls with `npx tsx scripts/<script>.ts`.

## When to use each repo

| Task | Where |
|------|-------|
| New data type from IS Mendelu | `../reis-scraper` — model after an existing script |
| Understanding scraped data shape | `../reis-scraper/db/schema.sql` + `../reis-data` |
| Extension CDN fetch / cache logic | `../reis-extension/src/api/` |
| Exporting new data to CDN | `../reis-scraper/audit/export-data.ts` → commit JSON to `../reis-data` |
| Notification data | Supabase MCP directly from the extension |

## Rules

- Before designing a new API shape in the extension, read `../reis-scraper/db/schema.sql` to understand what is already collected.
- Never copy scraper code into the extension — data always flows through reis-data as static JSON.
