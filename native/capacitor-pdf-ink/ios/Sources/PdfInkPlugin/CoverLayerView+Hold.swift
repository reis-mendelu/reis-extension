import UIKit

/**
 * Holding a finger on a strip: a small menu with one entry, delete — and if
 * the held finger then moves, the strip is carried instead. Dominik's asks on
 * the device (2026-10-03), the iOS home-screen pattern: hold for the menu,
 * move to carry. A menu rather than deleting on the hold
 * itself, so a hold that was only a pause cannot take a strip away; the
 * palette's undo brings a deleted one back all the same.
 */
@available(iOS 16.0, *)
extension CoverLayerView: UIEditMenuInteractionDelegate {
    /// 0.45 s "takes a bit too long" (Dominik, device). A tap is well under
    /// 0.2 s, so 0.3 s still tells them apart.
    static let holdDuration: TimeInterval = 0.3

    func installHold() {
        holdRecognizer.addTarget(self, action: #selector(held(_:)))
        holdRecognizer.minimumPressDuration = Self.holdDuration
        holdRecognizer.delegate = self
        // A hold is not a tap: the tap waits until the hold has failed, which
        // a touch lifted before `holdDuration` does at once.
        tapRecognizer.require(toFail: holdRecognizer)
        addInteraction(deleteMenuInteraction)
    }

    /// Hold: the delete menu comes up at once. Move the held finger and the
    /// menu goes and the strip follows it; let go and it stays there. Let go
    /// without moving and the menu stays for a tap.
    @objc private func held(_ hold: UILongPressGestureRecognizer) {
        let point = hold.location(in: self)
        switch hold.state {
        case .began:
            let down = holdTouchDown ?? point
            guard let id = holdCandidateID, let cover = covers.first(where: { $0.id == id }) else { return }
            NSLog("PdfInk: strip held, offering delete")
            heldCoverID = cover.id
            holdStart = down
            deleteMenuInteraction.presentEditMenu(
                with: UIEditMenuConfiguration(identifier: nil, sourcePoint: down))
        case .changed:
            guard let id = heldCoverID, let start = holdStart,
                let cover = covers.first(where: { $0.id == id })
            else { return }
            let offset = CGPoint(x: point.x - start.x, y: point.y - start.y)
            guard carriedRect != nil || hypot(offset.x, offset.y) > Self.carryThreshold else { return }
            if carriedRect == nil { deleteMenuInteraction.dismissMenu() }
            carriedRect = PageCovers.moved(cover.rect, by: offset, within: bounds)
        case .ended:
            if let id = heldCoverID, let rect = carriedRect {
                NSLog("PdfInk: strip moved")
                onMove?(id, rect)
                heldCoverID = nil
            }
            holdStart = nil
            carriedRect = nil
        default:
            heldCoverID = nil
            holdStart = nil
            carriedRect = nil
        }
    }

    /// A held finger trembles; past this it means to carry the strip.
    static let carryThreshold: CGFloat = 8

    /// The menu offered for a held strip.
    func deleteMenu(for id: String) -> UIMenu {
        UIMenu(children: [
            UIAction(title: deleteLabel, image: UIImage(systemName: "trash"), attributes: .destructive) {
                [weak self] _ in
                NSLog("PdfInk: strip deleted from the hold menu")
                self?.onRemove?(id)
            }
        ])
    }

    func editMenuInteraction(
        _ interaction: UIEditMenuInteraction, menuFor configuration: UIEditMenuConfiguration,
        suggestedActions: [UIMenuElement]
    ) -> UIMenu? {
        heldCoverID.map { deleteMenu(for: $0) }
    }
}
