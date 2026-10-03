import UIKit

/**
 * Holding a finger on a strip: a small menu with one entry, delete. Dominik's
 * ask on the device (2026-10-03). A menu rather than deleting on the hold
 * itself, so a hold that was only a pause cannot take a strip away; the
 * palette's undo brings a deleted one back all the same.
 */
@available(iOS 16.0, *)
extension CoverLayerView: UIEditMenuInteractionDelegate {
    func installHold() {
        holdRecognizer.addTarget(self, action: #selector(held(_:)))
        holdRecognizer.minimumPressDuration = 0.45
        holdRecognizer.delegate = self
        addGestureRecognizer(holdRecognizer)
        // A hold is not a tap: the tap waits until the hold has failed, which
        // a touch lifted before 0.45 s does at once.
        tapRecognizer.require(toFail: holdRecognizer)
        addInteraction(deleteMenuInteraction)
    }

    @objc private func held(_ hold: UILongPressGestureRecognizer) {
        guard hold.state == .began else { return }
        let point = hold.location(in: self)
        guard let cover = PageCovers.cover(at: point, in: covers) else { return }
        NSLog("PdfInk: strip held, offering delete")
        heldCoverID = cover.id
        deleteMenuInteraction.presentEditMenu(
            with: UIEditMenuConfiguration(identifier: nil, sourcePoint: point))
    }

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
