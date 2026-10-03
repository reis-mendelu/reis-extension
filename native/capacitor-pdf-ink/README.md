# @reis/capacitor-pdf-ink

iPad-only PDF reader with Apple Pencil ink. `PDFView` shows the pages, a `PKCanvasView`
sits on each page (`PDFPageOverlayViewProvider`, iOS 16) and `PKToolPicker` is the palette.
Consumed by `src/mobile/pdfInkNative.ts` via `registerPlugin('PdfInk')`.

Local package, never published. The app depends on it as `file:native/capacitor-pdf-ink`.
Why a package and not a file in the app target: `native/capacitor-secure-store/README.md`.

There is no Android half on purpose — Android keeps the pdf.js viewer. The guard test
`src/test/guards/nativePluginsAreReachable.test.ts` lists `PdfInk` under `IOS_ONLY`.

## Files

- `ios/Sources/PdfInkPlugin/InkArchive.swift` — the ink file format, a binary plist at
  version 3: `{version, pageCount, pages: [pageIndex: PKDrawing data], insertedPages,
  pictures: [pageIndex: [PagePicture]], coverCards: [pageIndex: [PageCover]]}`. New keys are
  additive and never bump the version (see the file's header). Foundation only.
- `ios/Sources/PdfInkPlugin/InkStore.swift` — load/save/delete; a corrupt file is renamed
  `*.ink.bad` rather than overwritten. Foundation only.
- `ios/Sources/PdfInkPlugin/PdfInkViewController.swift` — the reader.
- `ios/Sources/PdfInkPlugin/PdfInkPlugin.swift` — `isAvailable`, `open`.
- Covers over an answer: `CoverTool.swift` (the tape in the palette, iOS 18+), `PageCover.swift`,
  `PageCovers.swift`, `CoverLayerView.swift`, `PdfInkViewController+Covers.swift`.
- "Vyzkoušet se": `RecallSession.swift`, `PdfInkViewController+Recall.swift`.
- The rest of the reader: `PdfInkSpace.swift` (split view + file list), the other
  `PdfInkViewController+*.swift` extensions, `InkPages.swift`, `InkExport.swift`, pictures
  (`PagePicture(s)`, `PictureLayerView`, `PictureIngest`).

## Tests

`swift test` cannot run here: Capacitor is iOS-only and SwiftPM builds every target. Use
an iPad simulator instead (first run resolves capacitor-swift-pm, a few minutes):

    cd native/capacitor-pdf-ink
    xcodebuild test -scheme ReisCapacitorPdfInk \
      -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)'

`xcodebuild -list` shows the scheme names; `xcrun simctl list devices available` the simulators.
