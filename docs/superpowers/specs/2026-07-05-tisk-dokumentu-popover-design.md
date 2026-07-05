# Tisk dokumentů popover — design

**Date:** 2026-07-05
**Status:** Approved (brainstorming) → ready for implementation plan

## Summary

Replace the single "Potvrzení o studiu" quick-download row (added in `6fa1643`) in the
Student flyout with a **"Tisk dokumentů"** trigger that opens a popover listing every
IS document that can be downloaded in one click. Each row downloads a real PDF with a
proper filename and shows a per-row **spinner → checkmark / error** driven by the
*actual* completion of the download.

This supersedes and generalizes the in-progress `download_confirmation` SameSite fix:
the confirmation download folds into a generic `download_document` action.

## Background: verified IS behavior (2026-07-05)

Tested live against `is.mendelu.cz/auth/student/tisk_dokumentu.pl` via credentialed
`fetch()`. See memory `tisk-dokumentu-catalog`.

**One-GET synchronous PDFs** (`application/pdf` + `Content-Disposition: attachment`,
`%PDF` confirmed):

| Document | Trigger param | ~Size |
|---|---|---|
| Potvrzení o studiu (sealed) | `potvrzeni_tisk_el=1` | 173 KB |
| Přehled studia (sealed) | `prehled_tisk_el=1` | 234 KB |
| Registrační arch | `reg_arch_tisk=1` | 65 KB |

`;jazyk=eng` selects English *content* for the two sealed docs (EN sizes ~173/235 KB).
There is also a plain (unsealed) `potvrzeni_tisk=1` (59 KB), but the sealed variant is
strictly better (instant **and** sealed), so we use `_el` everywhere it exists.

**NOT one-click** (return `text/html`): `V7_tisk.pl?v7_tisk=1` (Přehled plain — preview
page needing a POST) and `zadost.pl` (Žádost — form needing typed input).

**Key correction:** the sealed `_el` variants download a *synchronous* PDF despite the
page text saying "…within an hour in Document storage" (that is a secondary filing
effect). An earlier review wrongly called them async based on that text.

**Why the earlier feature appeared to do nothing:** the shipped code ran the download
from a hidden iframe inside the **chrome-extension** app origin, which is cross-site to
`is.mendelu.cz`, so the `SameSite=Lax` session cookie was not sent → IS returned a login
page, not a PDF. `fetch()` works only because it runs **first-party in the content
script**. This design keeps all IS traffic in the content script.

## Document list (explicit CZ + EN rows)

| Row label (cs / en) | Trigger | Download filename |
|---|---|---|
| Potvrzení o studiu | `potvrzeni_tisk_el=1` | `Potvrzeni_o_studiu.pdf` |
| Confirmation of study | `potvrzeni_tisk_el=1;jazyk=eng` | `Confirmation_of_study.pdf` |
| Přehled studia | `prehled_tisk_el=1` | `Prehled_studia.pdf` |
| Study overview | `prehled_tisk_el=1;jazyk=eng` | `Study_overview.pdf` |
| Registrační arch | `reg_arch_tisk=1` | `Registracni_arch.pdf` |

All URLs are built with the ambient `studium` (sid) from the sync layer and IS's
`;`-separated param convention. `lang=cz` is fine for all (it only affects IS UI chrome,
which is irrelevant to a direct download); document content language is controlled by
`jazyk=eng`.

**Žádost na studijní oddělení** — a visually-separated **link-out** row at the bottom of
the popover that opens `is.mendelu.cz/auth/student/zadost.pl?studium=<sid>;lang=<lang>`
in a new tab (via the existing `open_url` / external-link path). It needs a typed subject
+ justification, so it cannot be one-click.

## Architecture

### State
- Store flag **`isDocumentsOpen`** (+ `setIsDocumentsOpen`) in the app store, mirroring
  the existing `isEduroamOpen` pattern — the documents popover, like eduroam, is opened
  from both the desktop flyout (`NavItem`) and the mobile sheet (`MobileNavSheet`) and
  must survive the flyout closing.

### Entry point
- In `MainItems.tsx`, the `is` item's children: **remove** the `potvrzeni-studia` row,
  **add** a first-position `dokumenty` row: `{ id: 'dokumenty', label: t('sidebar.documents'),
  icon: <FileText/>, isFeature: true }` (no `href` — it opens the popover).
- `NavItem.tsx` desktop handler: `child.id === 'dokumenty'` → `e.preventDefault();
  setIsDocumentsOpen(true)`.
- `MobileNavSheet.tsx` handler: `child.id === 'dokumenty'` → `setIsDocumentsOpen(true)`.
- Mount `<DocumentsPopover>` separately (next to `IsSearchPopovers` / the eduroam panel)
  so it outlives the hover flyout.

### Components
- **`DocumentsPopover.tsx`** — presentational popover: title "Tisk dokumentů", the doc
  rows, and the Žádost link-out. Owns per-row status (`idle | loading | done | error`)
  and calls the download hook. Closes on backdrop click / Esc. Reuse DaisyUI classes and
  the visual language of `IsPortalPopover` / `PeopleSearchPopover`.
- Row component (inline or small): icon + label; right side shows spinner when `loading`,
  check when `done` (revert to idle after ~2 s), error glyph + retry when `error`.

### Data / catalog
- **`src/api/studyDocuments.ts`** — pure module: the catalog (id, cs/en label key,
  trigger param, filename, `contentLang?`), `buildDocumentUrl(sid, doc)`, and the Žádost
  link URL builder. Unit-tested.

### Download flow (fetch-blob, real completion)
1. `DocumentsPopover` row → hook `useDocumentDownload()` → `downloadDocument(url, filename)`
   from `proxyClient.ts`.
2. **`proxyClient.downloadDocument(url, filename): Promise<void>`** — dispatches
   `executeAction('download_document', { url, filename })` and returns the promise (no
   error-swallowing wrapper; the caller needs success/failure to drive the row).
3. **`messageHandler.ts`** action `download_document`:
   - `const res = await fetch(url, { credentials: 'include' })`.
   - `401/403` or `content-type` not `application/pdf` → treat as session-expired:
     redirect the top page to `https://is.mendelu.cz/system/login.pl?lang=cz` (matching
     `handleFetchRequest`'s 401/403 branch) and `throw` so the handler sends an
     `actionResult` failure and the row shows `error`.
   - else `blob` → `URL.createObjectURL(blob)` → hidden `<a href download=filename>` in
     the content-script page → `.click()` → `URL.revokeObjectURL` (after a tick).
   - ack `{ success: true }` only after the anchor click (bytes already in memory ⇒ the
     save is effectively immediate) → the promise resolves ⇒ real completion signal.
4. Retire the `download_confirmation` action + `triggerConfirmationDownload` (hidden-iframe
   path) introduced by the in-progress fix; the fetch-blob path replaces them. Keep
   `buildConfirmationUrl` only if still referenced, otherwise fold into `studyDocuments`.

### i18n
- `sidebar.documents` = "Tisk dokumentů" / "Print documents".
- `documents.*` block: popover title, the five doc labels, the Žádost row label, and
  status/error strings ("Stahuji…", "Staženo", "Přihlas se do IS znovu", retry).

## Error handling

- **Session expired** (non-PDF / 401 / 403): row → `error`; content script redirects the
  top page to `https://is.mendelu.cz/system/login.pl?lang=cz` (matches existing behavior).
- **Network failure**: row → `error` with a retry affordance; no redirect.
- **Action timeout** (proxy `REQUEST_TIMEOUT`): surfaced as `error`.
- Errors are logged via `logError('Documents.download', …)` (no student data in context).

## Testing (test-first)

1. `studyDocuments` — `buildDocumentUrl` per doc (cz + jazyk=eng variants), filename map,
   Žádost link builder.
2. `messageHandler` `download_document` — mocked `fetch`: PDF blob → asserts an `<a>` with
   the right `download` filename is clicked and success is acked; non-PDF/401 → throws /
   failure ack (+ redirect assertion).
3. `proxyClient.downloadDocument` — dispatches `REIS_ACTION` `download_document` with
   `{ url, filename }` and resolves/rejects on the action result.
4. `DocumentsPopover` — renders all rows + Žádost link; click → `loading` → resolve →
   `done`; reject → `error` + retry. Language toggle shows correct labels.

## Out of scope / YAGNI

- No bidirectional or background document sync — this is on-demand download only.
- No caching of the PDFs (they are cheap and must be fresh).
- No Přehled-plain (`V7_tisk`) two-step POST — the sealed Přehled already covers it.
- No inline PDF preview — hand off to the browser's download manager.
