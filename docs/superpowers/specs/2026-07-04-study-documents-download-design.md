# Study Documents Download — Design Spec

**Date:** 2026-07-04
**Status:** Approved (directive: "potvrzeni o studiu is downloadable in Student reIS")

## Goal

Give students a one-click way to print/download their official study documents
(**Potvrzení o studiu**, Přehled studia, etc.) from inside reIS, without hunting
through the IS Mendelu portal. The entry point is the **Student popup**
(`ProfilePopup`); clicking it opens a modal to choose which document to open —
behaving exactly like the existing "IS stránky" / "Lidé" flyout popovers.

## Source of truth (scraped 2026-07-04)

The IS page `student/tisk_dokumentu.pl?studium=<id>;obdobi=<id>;lang=cz` lists
document icons as **plain GET `<a href>` links** (no forms). Verified real URLs
(relative to `https://is.mendelu.cz/auth/student/`). Each link needs only the
`studium` id + `lang`; **`obdobi` is not required**. English *content* variants
carry a fixed `jazyk=eng` (independent of the UI `lang`).

The page has two sections:

### 1. Elektronicky pečetěné dokumenty (e-sealed, official)
Clicking **generates** a sealed PDF that appears in *Úložiště dokumentů* within
~1 hour — it is **not** an instant download. The modal must say so.

| Document | URL |
|---|---|
| Potvrzení o studiu | `tisk_dokumentu.pl?potvrzeni_tisk_el=1;studium={{studium}};lang={{lang}}` |
| Potvrzení o studiu (EN) | `tisk_dokumentu.pl?potvrzeni_tisk_el=1;jazyk=eng;studium={{studium}};lang={{lang}}` |
| Přehled studia | `tisk_dokumentu.pl?prehled_tisk_el=1;studium={{studium}};lang={{lang}}` |
| Přehled studia (EN) | `tisk_dokumentu.pl?prehled_tisk_el=1;jazyk=eng;studium={{studium}};lang={{lang}}` |

### 2. Tisk dokumentů (plain print, instant PDF)

| Document | URL |
|---|---|
| Potvrzení o studiu | `tisk_dokumentu.pl?potvrzeni_tisk=1;studium={{studium}};lang={{lang}}` |
| Potvrzení o studiu (EN) | `tisk_dokumentu.pl?potvrzeni_tisk=1;jazyk=eng;studium={{studium}};lang={{lang}}` |
| Přehled studia | `../studijni/V7_tisk.pl?v7_tisk=1;studium={{studium}};lang={{lang}}` |
| Registrační arch | `tisk_dokumentu.pl?reg_arch_tisk=1;studium={{studium}};lang={{lang}}` |
| Žádost na studijní oddělení | `zadost.pl?studium={{studium}};lang={{lang}}` |

## Architecture

Because the links live on `is.mendelu.cz` and require the IS session cookie,
the download uses `window.open(url, '_blank')` — a real tab where the cookie is
present. This mirrors `IsPortalPopover.handleLinkClick` exactly. No content-script
fetch or telemetry-sensitive data crosses the iframe boundary.

| Unit | File | Responsibility |
|---|---|---|
| Document catalog | `src/data/studyDocuments.ts` | Static list: id, cs/en label, section, absolute href with `{{studium}}`/`{{lang}}` placeholders. Pure data + tested helper `buildDocumentUrl`. |
| Modal | `src/components/Sidebar/StudyDocumentsPopover.tsx` | Portal overlay (copy `IsPortalPopover` shell), two labelled sections, one button per doc → `window.open`. |
| Trigger | `src/components/Sidebar/ProfilePopup.tsx` | New action row "Potvrzení o studiu"; local `docsOpen` state renders the popover. |
| i18n | `src/i18n/locales/{cs,en}.json` | `studyDocs.*` keys (title, section headings + hints, document labels, trigger label). |

`buildDocumentUrl(doc, studiumId, lang)` reuses `injectUserParams` from
`src/data/pages/types.ts` (`{{studium}}`, `{{lang}}` substitution).

## Edge cases

- **No `studiumId`** (params not yet hydrated): disable the trigger row / show
  nothing rather than opening a broken URL. `injectUserParams` strips `studium=`
  when id is null, which would 404 — so guard on `studiumId` truthiness.
- Trigger only shown for IS Mendelu context (`!isIskam`), like the other
  student-only rows.

## Testing (test-first)

- `studyDocuments.test.ts`: `buildDocumentUrl` produces the exact scraped URLs
  for a known `studiumId`/lang; English variants keep `jazyk=eng`; every catalog
  entry has both cs & en labels and a section.
- Component smoke test optional; catalog correctness is the load-bearing part.

## Out of scope (YAGNI)

- Multi-select / batch download — each doc is one click; IS generates one at a time.
- Parsing the live `tisk_dokumentu.pl` page at runtime — the document set is
  standard across students; a static catalog + studium id is sufficient.
- Polling Úložiště for the sealed PDF — IS owns that; we just open the generator.
