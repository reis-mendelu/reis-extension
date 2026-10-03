import UIKit

/**
 * Covers: blocks over an answer, so a lecture can be read back before the
 * answer is (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * Making them is a visible mode, entered from `+` like arranging pictures:
 * the pens go, the bar is one Done, and one finger drags out blocks. Reading
 * them is not a mode — a tap opens or shuts a cover whenever the file is open.
 * `setCovers` is the only writer; it shows and saves at once.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    var hasCovers: Bool { covers.values.contains { !$0.isEmpty } }

    func beginCovering() {
        endArrangingPictures(restoringPens: false)
        makingCovers = true
        putPensAway()
        navigationItem.rightBarButtonItems = [doneCoveringItem]
        refreshCoverLayers()
    }

    /// The pens come back on every exit; `restoringPens` only decides whether
    /// the page takes the responder now (not when a file is closing).
    func endCovering(restoringPens: Bool = true) {
        guard makingCovers else { return }
        makingCovers = false
        navigationItem.rightBarButtonItems = fileToolItems
        refreshCoverLayers()
        if restoringPens { showToolPicker() } else { setPagePens(visible: true) }
    }

    @objc func doneCoveringTapped() { endCovering() }

    func setCovers(_ list: [PageCover], onPage index: Int) {
        guard list != (covers[index] ?? []) else { return }
        covers[index] = list.isEmpty ? nil : list
        overlays[index]?.coverLayer.covers = list
        persistNow()
    }

    func addCover(_ rect: CGRect, onPage index: Int) {
        setCovers((covers[index] ?? []) + [PageCover(rect: rect)], onPage: index)
    }

    func removeCover(_ id: String, onPage index: Int) {
        revealedCovers.remove(id)
        overlays[index]?.coverLayer.revealed = revealedCovers
        setCovers((covers[index] ?? []).filter { $0.id != id }, onPage: index)
    }

    func toggleCover(_ id: String, onPage index: Int) {
        if revealedCovers.contains(id) {
            revealedCovers.remove(id)
        } else {
            revealedCovers.insert(id)
        }
        overlays[index]?.coverLayer.revealed = revealedCovers
    }

    /// Called for every overlay PDFKit asks for, so a page that scrolls in
    /// mid-mode behaves like the rest.
    func configureCovers(of overlay: PageOverlayView, page index: Int) {
        let layer = overlay.coverLayer
        layer.covers = covers[index] ?? []
        layer.currentColor = tint ?? .tintColor
        layer.onCreate = { [weak self] rect in self?.addCover(rect, onPage: index) }
        layer.onRemove = { [weak self] id in self?.removeCover(id, onPage: index) }
        layer.onToggle = { [weak self] id in self?.toggleCover(id, onPage: index) }
        applyCoverMode(to: overlay)
    }

    func refreshCoverLayers() {
        for overlay in overlays.values { applyCoverMode(to: overlay) }
    }

    private func applyCoverMode(to overlay: PageOverlayView) {
        overlay.coverLayer.revealed = revealedCovers
        overlay.coverLayer.isMakingCovers = makingCovers
        // Arranging moves pictures with the finger; a cover on top would catch it.
        overlay.coverLayer.isUserInteractionEnabled = !arrangingPictures
    }
}
