# /repos

Orientation skill for the three active reis-mendelu repos. Use this when a task touches scraped data, the CDN data pipeline, or requires building a new IS Mendelu scraper.

## Repo Map

All repos are siblings under `../` relative to `reis-extension`:

| Repo | Path | Role |
|------|------|------|
| **reis-extension** | `../reis-extension` | The browser extension — consumes CDN data and Supabase at runtime |
| **reis-scraper** | `../reis-scraper` | Playwright scraper — logs into IS Mendelu with real credentials, crawls data |
| **reis-data** | `../reis-data` | Static file CDN — pre-crawled subject difficulty JSON served via jsDelivr |

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

Spawn a sub-agent pointed at `../reis-scraper` that:
1. Reads the relevant script(s) in `scripts/` for context and patterns
2. Writes or runs the crawl (`npx tsx scripts/<script>.ts`)

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
- Scraper tasks always go through a dedicated sub-agent.
