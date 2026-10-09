# reIS for Claude — student MCP (design)

Decided with Dominik on 2026-10-09/10. Context and the reasoning behind each
choice are in memory `student-mcp-product`.

## What it is

A **Claude Desktop extension (`.mcpb`)** that a student installs on their own
laptop. It logs in to IS Mendelu as that student and gives Claude read-only
tools over their own study data. It is the fourth product from this codebase,
next to the browser extension, iOS and Android. It reuses reIS's own fetchers
and parsers from `src/`.

## Decisions

| Topic | Decision |
| --- | --- |
| Audience | A feature for students, not a showcase. Reach is Claude Desktop on a laptop only. |
| University | Not shown to anyone before release. |
| Data path | Student laptop ↔ is.mendelu.cz (and the public reis-data CDN for success rates). Nothing passes through reIS servers. **No hosted gateway, ever.** |
| Login | The student enters their IS username and password in the extension's Claude Desktop settings. The password is a `sensitive` user_config field, so it lives in the OS keychain. The tool logs in with a browserless form POST, and logs in again when the session lapses. This is the first reIS code that handles a password. |
| 2FA | IS's login form already carries 2FA fields. If an account answers with a 2FA challenge, fail with a clear message. Not supported in v1. |
| Distribution | 1) A `.mcpb` attached to a public GitHub release of reis-extension under an `mcp-v*` tag. 2) Anthropic's directory once it is stable, because only the directory auto-updates. |
| Counting | None. The tool sends nothing to reIS. Revisit at directory time; counting would be a new disclosed data flow. |
| Code | `reis-extension/mcp/`, its own host directory like `capacitor/` and `dev/`. Nothing MCP-only goes into shared `src/`. reis-scraper's private dev MCP stays as it is. |

## Tools (v1, read-only)

`mendelu_schedule`, `mendelu_exams`, `mendelu_subjects`, `mendelu_study_plan`,
`mendelu_syllabus`, `mendelu_subject_files`, `mendelu_read_file`,
`mendelu_success_rates`, `mendelu_grades`, `mendelu_assignments`.

The tools always fill in the student's study context (`studium`, `obdobi`), so
the model never has to know it.

## Hard rules

- **No generic page fetch.** No `raw`/`table` tools: IS has GET parameters that change state, found by a 2026-10-09 crawl. Examples: `personalizace/portlety.pl` (`vypni`, `skryt`, `move`), `personalizace/menu_user.pl` (`move`, `dir`), `posta/slozky.pl` (`move`, `prejmenuj`), `student/list.pl` (`akce`, `email_on`), `ca/ucet.pl` (`blokace`).
- **Never touch online tests** (`elis/ot/psani_testu.pl`). Never submit anything. `mendelu_assignments` strips `uploadUrl`.
- **Never retry a login that failed on credentials or 2FA.** Two failed logins per call could lock the account. Any failed login also blocks the next attempt for 60 s, and 3 unexpected failures in a row stop retries until restart.
- **Never write credentials or the session cookie** to disk, stderr or a tool result. Error messages are fixed strings.
- **Talk to two hosts only:** `is.mendelu.cz` gets the cookie, `cdn.jsdelivr.net` does not.
- **Output follows reis-scraper's `toResult` semantics** (fixed 2026-10-09). Markdown mode returns text only. JSON mode attaches `structuredContent` only when it fits the character limit. No tool declares an `outputSchema`.
