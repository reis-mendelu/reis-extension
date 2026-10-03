# iPad ink reader: covers and "Vyzkoušet se"

> **Revised 2026-10-03, after device use — read this first.** Two parts of this
> spec are superseded. (1) Covers are made with **the tape**, a pen in the palette,
> not a `+` menu mode (see "Making covers: the tape"). (2) **"Vyzkoušet se" was
> built, shipped to the iPad, and removed**: Dominik's verdict was that stepping
> through covers with Ukázat / Znám / Ještě ne is over-engineering — "the only
> thing we really needed is the tool to hide a section". `PageCover` therefore
> carries no answer history, and part 3 (exam-date review) is dropped with it.
> The sections on the test, its strings and its tests below are history.
> Also from that round: a cover is drawn as masking tape (`TapeStyle`), any
> stroke longer than 6 pt makes one and nothing is thinner than 16 pt, a cover
> starts where the touch came down (not where the pan began), and every other
> page gesture waits for a tap on a cover (fast taps were being lost to PDFKit's
> word-selection double tap).


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
- **A drag creates, a tap removes** while making covers; a drag shorter than
  24 pt makes nothing.

**What did not survive: raw touches.** The withdrawn layer handled
`touchesBegan/Ended`, and on the student's iPad dragging out a cover did not
work — PDFKit's scroller claimed the drag and the page slid (`ed7016e4`, which
tried pinning the scroller and was withdrawn hours later with creation still
unproven on a device). The cover layer now uses the picture layer's pattern
from #492, proven on the device: a pan (cover mode only, one finger) and a tap,
which PDFKit's scroll recognizers are required to wait for. A tap fails when the
finger travels, so a scroll that starts on a cover never opens it. Two fingers
still scroll in cover mode. Covers are proven on the iPad before the test is
built on them.

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

## Making covers: the tape

**Revised 2026-10-03 after the first device build.** The planned `+` menu entry
with a mode of its own ("Zakrýt odpověď", a bar that becomes one *Hotovo*) was
built and put on the iPad, and Dominik's verdict was that it was not intuitive:
"it should be a pen". Covers are now made with **the tape**, a
`PKToolPickerCustomItem` in the pen palette right after the marker (`CoverTool`).

- **Pick the tape, drag the Pencil**: a grey block, the way a pen would draw ink.
  While the tape is picked PencilKit switches drawing off on every canvas that
  observes the palette, and the tape's drag (a pan on `PageOverlayView`, above
  the canvas) takes the stroke. Every other gesture on the page waits for it,
  PDFKit's markup gestures over text included.
- **A finger still scrolls** when a Pencil is paired: the drag takes only
  touches that draw (the Pencil, plus the finger when the finger draws).
- **A drawing tap with the tape takes a cover away**, and the palette's undo
  brings it back: covers go on the same undo manager as strokes and pictures. A
  finger tap (with a Pencil paired), or any tap with another tool, opens or
  shuts the cover.
- **No bar of its own, no mode.** The pens never leave the screen.
- **iOS 18+** for the custom palette item. Below that the palette is Apple's
  default: covers can be opened and tested, not made (iPads stuck below
  iPadOS 18 are the 6th generation and older).
- **The palette's selection outlives the reader.** A reader that opens with the
  tape picked starts in tape mode, and a canvas made then is never handed
  `selectedTool`: with the tape picked that is not a tool a canvas can hold, and
  PencilKit traps on it ("Unknown PKTool type"), found by the Swift suite.
- **Starting a test hands back the pen**, and the tape does nothing during a test:
  the Pencil is for writing answers, and a tap must look under the cover being
  asked, never take it away. Found driving the simulator.

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

**Leaving early.** *Ukončit*, switching file in the sidebar or closing the reader
ends the test. Backgrounding does not: a glance at Control Center must not throw
a test away, and if the system kills the app the test is gone like any other
in-memory state. Marks already given are kept either way, because each one is
saved as it is given; nothing else about the test is saved (no "resume at
cover 4").

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
| cover | Páska | Tape |
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
