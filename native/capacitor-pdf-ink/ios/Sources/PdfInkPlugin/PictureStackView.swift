import UIKit

/**
 * One side of the ink's pictures, drawn and nothing else.
 *
 * A page has two: one under the canvas (`PictureLayerView.belowInk`) and one
 * over it, inside the layer that also carries the handles. PencilKit's ink is
 * one view per page, so "over" and "under" are two views either side of it,
 * not a position in a single list.
 */
final class PictureStackView: UIView {
    /// Already filtered to this side, in stacking order.
    var pictures: [PagePicture] = [] {
        didSet { sync() }
    }
    /// What is on screen, bottom to top; the tests read it.
    var shownIDs: [String] { pictures.map(\.id) }

    private var imageViews: [String: UIImageView] = [:]

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isUserInteractionEnabled = false
    }

    required init?(coder: NSCoder) { fatalError("PictureStackView is code-only") }

    private func sync() {
        let ids = Set(pictures.map(\.id))
        for (id, view) in imageViews where !ids.contains(id) {
            view.removeFromSuperview()
            imageViews[id] = nil
        }
        for picture in pictures {
            let view =
                imageViews[picture.id]
                ?? {
                    let view = UIImageView(image: UIImage(data: picture.jpeg))
                    view.contentMode = .scaleToFill
                    imageViews[picture.id] = view
                    return view
                }()
            view.frame = picture.frame
            addSubview(view)  // re-adding moves it to the top: array order is stacking order
        }
    }
}
