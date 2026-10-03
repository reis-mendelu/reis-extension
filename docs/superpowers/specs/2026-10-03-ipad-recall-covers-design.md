# iPad ink reader: covers and "Vyzkoušet se"

Date: 2026-10-03. Scope: the native iPad reader (`native/capacitor-pdf-ink`) only.

## Why

Of everything a study app can add, two techniques have strong evidence behind them:
retrieval practice and spacing (Dunlosky et al. 2013; Roediger & Karpicke 2006;
Cepeda et al. 2006). Highlighting and rereading are weak. The reader today is
an excellent place to *write* on a lecture and has nothing for *recalling* it.

This spec is part 1 and 2 of three:

1. **Covers** — a block over part of a page; tap to look under, tap to shut.
2. **Vyzkoušet se** — go through a lecture's covers one by one and mark each
   *Znám* or *Ještě ne*. The marks are kept.
3. *(Next spec, not this one.)* Review scheduled backward from the student's
   registered exam date (`registeredTerm.date`), with a local notification. It
   reads the marks part 2 records, which is why they carry a full history.

Collaboration was considered and rejected on privacy grounds (2026-10-03). Nothing
here leaves the device, and `privacy/disclosures.ts` does not change.

## History: the cover tool already existed

Built in `d5026aaef` (2026-09-07), withdrawn the same day in `aec6f7b6f` to close
PR #304 — a scope call, "not now", not a rejection. Its decisions stand and are
carried over unchanged:

- **Making covers is a mode, and a visible one.** The bar button fills in and the
  tool picker goes, because the finger is drawing blocks, not ink.
- **Reading them is not a mode.** A tap opens or shuts a cover whenever the file
  is open.
- **Which covers are open is never saved.** Reopening a file is exactly when the
  answers should be hidden again.
- **Covers are not exported.** A shared PDF is the student's notes; a study aid
  baked in would hide the answer from whoever receives it.
- **Own layer, invisible elsewhere.** Outside a cover the layer's `hitTest`
  returns nil, so ink and scrolling reach the canvas exactly as before. Inside
  one it takes the touch, which is also why a covered patch cannot be drawn on.
- **`PageCovers` owns the ambiguous gesture.** While making covers: a drag
  creates, a tap removes, a drag shorter than 24 pt is a tap, and a small block
  drawn on a big one is a new cover, never a delete.

What has changed since, and what this spec adds:

- **Pictures (#492)** added `PictureLayerView` over the ink and a finger tap that
  picks a picture up (`+PickUp.swift`). Covers must sit above both.
- **Covers get identity and history**, so a mark can belong to one cover.
- **Vyzkoušet se** is new.

## Data

```swift
struct PageCover: Codable, Equatable {
    var id: String               // a UUID string, like PagePicture.id
    var rect: CGRect             // page points, the same space as the drawing
    var reviews: [CoverReview]   // oldest first; empty until first tested
}

struct CoverReview: Codable, Equatable {
    var date: Date
    var knew: Bool               // Znám = true, Ještě ne = false
}
```

`InkArchive` gains `coverCards: [Int: [PageCover]]`, per page index in stacking
order, the same shape as `pictures`.

- **Additive key, version stays 3**, for the reason `pictures` gives: a bump makes
  an older build quarantine the whole file, ink included. The accepted cost is
  the same too — an older build ignores the key and drops it on its next save.
- **The withdrawn `covers` key** (`[Int: [CGRect]]`) exists only in archives
  written by dev builds on 2026-09-07. When `coverCards` is absent and `covers` is
  present, decode converts each rectangle to a `PageCover` with a fresh id and no
  reviews. Encode never writes `covers`. If `covers` fails to decode it is
  ignored, never fatal — the ink must still open.
- **Covers count as content.** An archive whose only content is covers is not
  deleted on save (the existing empty-archive check gains `coverCards`).
- **Page shifts.** Adding or removing a page moves covers with
  `InkPages.shifted(_:insertingAt:)` / `(_:removingAt:)`, which are already
  generic over the value. Removing a page removes its covers.
- **Size.** A review is a date and a bool. Even 100 covers × 50 reviews is a few
  tens of kB; no cap.

Open covers are `Set<String>` (ids) in memory, never saved. Ids replace the withdrawn
tool's positional `revealed` set, which had to shut every open cover on a page
whenever one was removed.

## Layering and touches

`PageOverlayView`, bottom to top: pictures below ink, canvas, pictures over ink
(`PictureLayerView`), **covers (`CoverLayerView`)**.

- The cover layer's `hitTest` returns nil outside a cover, as before, so the
  picture layer, its pick-up tap and the canvas behave exactly as now everywhere
  else.
- On a cover, the cover wins: a finger tap opens or shuts it even over a picture.
  The pick-up recognizer's `gestureRecognizerShouldBegin` also returns false when
  the point is inside a cover, so the two never both fire.
- **Making covers and arranging pictures are mutually exclusive.** Turning one on
  turns the other off.
- The cover layer is exactly the page with no transform, like the picture layers;
  its coordinates are page points. `PageOverlayView`'s size rule is untouched.

## Making covers

**From the `+` menu, like arranging pictures** (refined 2026-10-03 while
planning). The `+` menu exists "so the bar stays at five buttons", and arranging
pictures already shows how a mode looks in this reader: the pens go and the bar
becomes one *Hotovo*. *Zakrýt odpověď* is a fourth section of that menu and
enters the same shape of mode with its own *Hotovo*. The withdrawn tool's
separate `square.dashed` bar button is not brought back.

As in `d5026aaef`, a shut cover is filled `systemGray4` and an open one leaves a
dashed `systemGray2` outline; the layer is pinned light like the canvas (the page
is always white). The current cover in a test gets a 2 pt outline in the theme
tint.

## Vyzkoušet se

**Entry.** A bar button, *Vyzkoušet se* (`checklist`), enabled only when the open
file has at least one cover. It is not a separate screen; it is a state of the
reader.

**Order.** Reading order: page index, then top to bottom, then left to right.
Covers on added pages count like any other.

**One step.**

1. At the start every cover is shut.
2. The reader scrolls to the current cover with some margin around it, and marks
   it with an accent outline. The other covers stay as they are.
3. The student taps the cover, or *Ukázat* in the bar, to reveal it.
4. The bar now offers **Znám** and **Ještě ne**. Either one appends a `CoverReview`,
   saves immediately (`persistNow`) and moves to the next cover.

**Controls live in the navigation bar**, not in a floating panel, so they can
never sit under the tool picker, which floats wherever the student put it. While
a test runs, the title is the progress *3 z 10* and the trailing items are, right
to left, *Ukončit* then *Ukázat* — or *Ukončit*, *Znám*, *Ještě ne* once the
cover is open. *Ukončit* sits trailing, not leading: the leading group holds the
reader's exit X beside the split view's own toggle, which took a day to get right
(`exitItem`), and is not touched. The usual items come back when the test ends.

**The entry button** is the only new item in the normal bar, nearest the title,
and hidden — not just disabled — while the file has no covers.

**The Pencil still draws.** Writing the answer before revealing it is the
strongest form of recall. The finger still scrolls. Tapping a cover that is not
the current one opens or shuts it as usual and records nothing.

**End.** A summary alert: *Znáš 8 z 10* and, if any were *Ještě ne*, **Zopakovat ty, co ještě
neznám**, which runs the same loop over just those covers. *Hotovo* returns the
reader to normal with every cover shut.

**Leaving early.** *Ukončit*, switching file in the sidebar, closing the reader
or backgrounding the app ends the test. Marks already given are kept; nothing
else is saved about the test (no "resume at cover 4").

**Logic lives outside the view controller.** `RecallSession` is plain Swift
(Foundation + CoreGraphics only): given `[Int: [PageCover]]` it produces the
order, holds the current position, records an answer (returns the `CoverReview` to
append), and produces the "only Ještě ne" follow-up session. The view controller
is already 823 lines. The cover mode goes in `PdfInkViewController+Covers.swift`
and the test in `PdfInkViewController+Recall.swift`.

## Strings

All new strings go through `PdfInkStrings`, fed from `src/i18n/locales/{cs,en}.json`
like the existing ones: `t('mobile.pdfInk.*')` in `usePdfInkStrings.ts`, typed in
`pdfInk.ts`, as the withdrawn tool did. Czech wording is gender-neutral:

| key | cs | en |
| --- | --- | --- |
| cover | Zakrýt odpověď | Cover an answer |
| recallStart | Vyzkoušet se | Test me |
| recallReveal | Ukázat | Show |
| recallKnew | Znám | I know it |
| recallNotYet | Ještě ne | Not yet |
| recallProgress | {n} z {total} | {n} of {total} |
| recallEnd | Ukončit | End |
| recallScore | Znáš {known} z {total} | You know {known} of {total} |
| recallRetry | Zopakovat ty, co ještě neznám | Repeat the ones I don't know yet |

## Trees and parity

iPad only, by nature: covers live in the native PencilKit reader. Android keeps
the pdf.js viewer with no ink, and the extension has no ink. The guard
`src/test/guards/nativePluginsAreReachable.test.ts` already lists `PdfInk` under
`IOS_ONLY`. A guard `src/test/guards/inkCoversAreIpadOnly.test.ts`, modelled on
`inkPicturesAreIpadOnly.test.ts`, names the shared files so the tree-parity Stop
hook is answered in code. *Hotovo* reuses the existing `done` string. The only
shared files touched are the locale JSONs and the strings
plumbing in `src/mobile/pdfInk.ts` and `src/hooks/ui/usePdfInkStrings.ts` (plus the strings fixture in `src/mobile/__tests__/pdfInk.test.ts`).

## Testing

**Swift unit tests** (`native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/`):

- `InkArchiveTests`
  - `coverCards` round-trips.
  - A v3 archive with the legacy `covers` key opens with its ink **and** its
    covers converted.
  - A malformed `covers` still opens with its ink.
  - An archive with only covers survives the empty check.
- `PageCoversTests`: restored from `d5026aaef`, adapted to `PageCover`.
- `CoverTouchRoutingTests`: restored. Add one case: a tap on a cover that sits
  over a picture opens the cover and does not pick the picture up.
- `RecallSessionTests`
  - Reading order across pages and within a page.
  - Answer appends a review with the given date.
  - The retry session holds exactly the *Ještě ne* covers, in order.
  - An empty input yields no session.
- `InkPagesTests`: covers shift on insert and on remove.
- `ReaderScaleTests`: bar contents updated for the two new buttons. New reader
  tests call `reader.willClose()` in tearDown (the #492 test-order trap).

These run only with `xcodebuild test`, which boots a simulator. Per Dominik's
2026-10-03 instruction, **ask before running them**.

**Device:** a release build on the cabled iPad 8, then a precise tap script for
Dominik, with before/after screenshots sent. The old checklist items 29–33 come
back into `2026-09-06-ipad-pdf-ink-verification-checklist.md`, plus:

- Make three covers on two pages, one over a picture.
- Vyzkoušet se → each cover in reading order, *Ukázat*, *Znám* / *Ještě ne*.
- The summary → *Zopakovat* runs only the *Ještě ne* ones.
- Write with the Pencil beside a cover during the test → the ink stays.
- *Ukončit* halfway, close the reader, reopen → covers shut, earlier marks kept.
  Marks are not visible yet; they are checked by the unit tests and the archive.
- Add a page before a covered page → the covers move with their page.
- Share with notes → the answers are visible in the PDF.

## Docs

- Append an addendum to `2026-09-06-ipad-pdf-ink-design.md` pointing here; its
  "WITHDRAWN" addendum stays as history.
- Fix `native/capacitor-pdf-ink/README.md`: its format omits `insertedPages`,
  `pictures` and now `coverCards`, and its file list is stale.

## Out of scope

- Scheduling, notifications and the exam date (part 3).
- Showing marks outside a test, e.g. a tint on covers last marked *Ještě ne*.
  Part 3 decides how marks surface.
- Tests across files or subjects.
- Covers that are not rectangles, such as lasso shapes or covers on ink strokes.
- Undo for covers through the palette. The withdrawn tool did not have it either;
  removing a cover is a deliberate tap in cover mode.
