import PencilKit
import UIKit

/**
 * Covers: blocks over an answer, so a lecture can be read back before the
 * answer is (spec 2026-10-03-ipad-recall-covers-design.md).
 *
 * Made with the tape, a tool in the pen palette (`CoverTool`): pick it and the
 * Pencil drags out blocks the way it would draw ink, while a finger still
 * scrolls. No separate mode, no bar of its own. Reading covers is never a mode
 * either: a tap opens or shuts one whenever the file is open.
 *
 * `setCovers` is the only writer. It shows and saves at once, and registers
 * its reverse on the same undo manager as strokes and pictures, so the
 * palette's undo takes back a cover put down or taken away by mistake.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    var hasCovers: Bool { covers.values.contains { !$0.isEmpty } }

    @available(iOS 18.0, *)
    func toolPickerSelectedToolItemDidChange(_ toolPicker: PKToolPicker) {
        coverToolDidChange()
    }

    /// Reads the palette: is the tape in hand?
    func coverToolDidChange() {
        makingCovers = CoverTool.isSelected(in: toolPicker)
        NSLog("PdfInk: tape \(makingCovers ? "picked" : "put down")")
        refreshCoverLayers()
    }

    func setCovers(_ list: [PageCover], onPage index: Int) {
        let before = covers[index] ?? []
        guard list != before else { return }
        covers[index] = list.isEmpty ? nil : list
        overlays[index]?.coverLayer.covers = list
        undoManagerForPictures?.registerUndo(withTarget: pictureUndoTarget) { [weak self] _ in
            self?.setCovers(before, onPage: index)
        }
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
    /// while the tape is in hand behaves like the rest.
    func configureCovers(of overlay: PageOverlayView, page index: Int) {
        let layer = overlay.coverLayer
        layer.covers = covers[index] ?? []
        layer.fingerDraws = { [weak self] in self?.fingerDraws() ?? false }
        layer.onCreate = { [weak self] rect in self?.addCover(rect, onPage: index) }
        layer.onRemove = { [weak self] id in self?.removeCover(id, onPage: index) }
        layer.onToggle = { [weak self] id in self?.toggleCover(id, onPage: index) }
        applyCoverMode(to: overlay)
    }

    func refreshCoverLayers() {
        for overlay in overlays.values { applyCoverMode(to: overlay) }
    }

    func applyCoverMode(to overlay: PageOverlayView) {
        overlay.coverLayer.revealed = revealedCovers
        // Arranging moves pictures with the finger; covers keep out of its way.
        overlay.coverLayer.isMakingCovers = makingCovers && !arrangingPictures
        overlay.coverLayer.isUserInteractionEnabled = !arrangingPictures
        // PencilKit switches drawing off on the canvases observing the palette
        // when the tape is picked. A canvas made after that is told here.
        if #available(iOS 18.0, *), makingCovers { overlay.canvas.isDrawingEnabled = false }
    }
}
