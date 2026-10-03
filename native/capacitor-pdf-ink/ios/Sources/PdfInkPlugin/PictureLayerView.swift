import UIKit

/**
 * The pictures on one page: the ones over the ink, the handles, and the
 * gestures. The ones under the ink are drawn by `belowInk`, which the overlay
 * puts under the canvas — PencilKit's ink is one view, so the two sides of it
 * are two views.
 *
 * It renders and it reports; it decides nothing. The reader owns the pictures
 * (`pictures[pageIndex]`, like `drawings`), hands them in, and gets the new list
 * back once per finished gesture through `onCommit` — so each move is one undo
 * step and one save, not one per frame of a drag.
 *
 * It is invisible to touches unless the reader is arranging, and even then it
 * takes only touches on a picture or on the selected one's chrome: `hitTest`
 * returns nothing elsewhere, so a finger on empty page still scrolls.
 *
 * Its coordinates are the page's points (PageOverlayView), and PDFKit scales the
 * whole page view, so the chrome is drawn at `chromeScale` (1 / the page scale)
 * to stay the same size on screen at any zoom.
 */
final class PictureLayerView: UIView, UIGestureRecognizerDelegate {
    var pictures: [PagePicture] = [] {
        didSet {
            belowInk.pictures = pictures.filter { !$0.aboveInk }
            aboveInk.pictures = pictures.filter(\.aboveInk)
            setNeedsLayout()
        }
    }
    /// Drawn under the canvas; the overlay owns where it sits.
    let belowInk = PictureStackView()
    /// Drawn here, over the canvas and under the handles.
    let aboveInk = PictureStackView()
    var selectedID: String? {
        didSet { setNeedsLayout() }
    }
    var arranging = false {
        didSet {
            isUserInteractionEnabled = arranging
            if !arranging { selectedID = nil }
        }
    }
    var chromeScale: CGFloat = 1 {
        didSet { if chromeScale != oldValue { setNeedsLayout() } }
    }
    var deleteLabel = "Delete" {
        didSet { deleteButton.accessibilityLabel = deleteLabel }
    }
    /// The … menu's one entry, by where the selected picture is now.
    var underInkLabel = "Under the notes" {
        didSet { setNeedsLayout() }
    }
    var overInkLabel = "Over the notes" {
        didSet { setNeedsLayout() }
    }
    var moreLabel = "More"
    var onSelect: ((String) -> Void)?
    var onCommit: (([PagePicture]) -> Void)?

    /// On-screen sizes, before `chromeScale`.
    static let handleSide: CGFloat = 22
    static let deleteSide: CGFloat = 40

    private let chrome = UIView()
    private let outline = CAShapeLayer()
    private var handles: [PictureCorner: UIView] = [:]
    private let deleteButton = UIButton(type: .system)
    /// "…": the selected picture's less common actions — today, the side of
    /// the ink. A main button for it read as unintuitive on the device.
    let moreButton = UIButton(type: .system)
    private enum Gesture {
        case move(id: String, start: CGRect)
        /// `grab` is where the finger is relative to the true corner: a handle
        /// pulled onto the page is not on the corner, and the picture must not
        /// jump by that much when the drag starts.
        case resize(id: String, corner: PictureCorner, start: CGRect, grab: CGPoint)
        case pinch(id: String, start: CGRect)
    }
    private var gesture: Gesture?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isUserInteractionEnabled = false
        chrome.isUserInteractionEnabled = true
        outline.fillColor = nil
        chrome.layer.addSublayer(outline)
        for corner in PictureCorner.allCases {
            let handle = UIView(frame: CGRect(x: 0, y: 0, width: Self.handleSide, height: Self.handleSide))
            handle.backgroundColor = .white
            handle.layer.cornerRadius = Self.handleSide / 2
            handle.layer.borderWidth = 2
            handle.isUserInteractionEnabled = false
            handles[corner] = handle
            chrome.addSubview(handle)
        }
        var config = UIButton.Configuration.filled()
        config.image = UIImage(systemName: "trash")
        config.baseBackgroundColor = .systemRed
        config.cornerStyle = .capsule
        deleteButton.configuration = config
        deleteButton.frame = CGRect(x: 0, y: 0, width: Self.deleteSide, height: Self.deleteSide)
        deleteButton.accessibilityLabel = deleteLabel
        deleteButton.addTarget(self, action: #selector(deleteTapped), for: .touchUpInside)
        chrome.addSubview(deleteButton)
        var more = UIButton.Configuration.filled()
        more.image = UIImage(systemName: "ellipsis")
        more.cornerStyle = .capsule
        moreButton.configuration = more
        moreButton.frame = deleteButton.frame
        moreButton.showsMenuAsPrimaryAction = true
        chrome.addSubview(moreButton)
        addSubview(aboveInk)
        addSubview(chrome)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
        for recognizer in [pan, pinch, tap] as [UIGestureRecognizer] {
            recognizer.delegate = self
            addGestureRecognizer(recognizer)
        }
    }

    required init?(coder: NSCoder) { fatalError("PictureLayerView is code-only") }

    // MARK: - Touches

    /// Whether a touch at `point` is this layer's: a picture, or the selected
    /// picture's handles and Delete. Everything else is the page's.
    func takesTouch(at point: CGPoint) -> Bool {
        guard arranging else { return false }
        if selectedFrame != nil {
            if deleteButton.frame.contains(point) || moreButton.frame.contains(point) {
                return true
            }
            if handleCorner(at: point) != nil { return true }
        }
        return PagePictures.topmost(at: point, in: pictures) != nil
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        takesTouch(at: point)
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, takesTouch(at: point) else { return nil }
        if selectedFrame != nil, deleteButton.frame.contains(point) { return deleteButton }
        if selectedFrame != nil, moreButton.frame.contains(point) { return moreButton }
        return self
    }

    /// PDFView's scroll and zoom wait for ours to fail, so dragging a picture
    /// never scrolls the page under it. Ours only ever see touches on pictures.
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view is UIScrollView
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer.view === self
    }

    @objc private func tapped(_ tap: UITapGestureRecognizer) {
        guard let picture = PagePictures.topmost(at: tap.location(in: self), in: pictures) else { return }
        selectPicture(picture.id)
    }

    @objc private func panned(_ pan: UIPanGestureRecognizer) {
        let translation = pan.translation(in: self)
        switch pan.state {
        case .began:
            let start = CGPoint(x: pan.location(in: self).x - translation.x, y: pan.location(in: self).y - translation.y)
            if let selectedID, let frame = selectedFrame, let corner = handleCorner(at: start) {
                let tip = PagePictures.point(of: corner, in: frame)
                gesture = .resize(
                    id: selectedID, corner: corner, start: frame,
                    grab: CGPoint(x: start.x - tip.x, y: start.y - tip.y))
            } else if let picture = PagePictures.topmost(at: start, in: pictures) {
                selectPicture(picture.id)
                gesture = .move(id: picture.id, start: picture.frame)
            }
        case .changed:
            switch gesture {
            case .move(let id, let start):
                setFrame(PagePictures.moved(start, by: translation, in: bounds.size), of: id)
            case .resize(let id, let corner, let start, let grab):
                let finger = pan.location(in: self)
                let tip = CGPoint(x: finger.x - grab.x, y: finger.y - grab.y)
                setFrame(PagePictures.resized(start, dragging: corner, to: tip, in: bounds.size), of: id)
            default: break
            }
        case .ended, .cancelled, .failed:
            finishGesture()
        default: break
        }
    }

    @objc private func pinched(_ pinch: UIPinchGestureRecognizer) {
        switch pinch.state {
        case .began:
            let target = PagePictures.topmost(at: pinch.location(in: self), in: pictures)
                ?? pictures.first { $0.id == selectedID }
            guard let target else { return }
            selectPicture(target.id)
            gesture = .pinch(id: target.id, start: target.frame)
        case .changed:
            if case .pinch(let id, let start) = gesture {
                setFrame(PagePictures.scaled(start, by: pinch.scale, in: bounds.size), of: id)
            }
        case .ended, .cancelled, .failed:
            finishGesture()
        default: break
        }
    }

    @objc private func deleteTapped() { deleteSelected() }

    /// Over the ink ↔ under it, as one undoable change. Stays selected.
    func toggleSelectedInkSide() {
        guard let index = pictures.firstIndex(where: { $0.id == selectedID }) else { return }
        pictures[index].aboveInk.toggle()
        onCommit?(pictures)
    }

    func deleteSelected() {
        guard let selectedID else { return }
        pictures.removeAll { $0.id == selectedID }
        self.selectedID = nil
        onCommit?(pictures)
    }

    private func selectPicture(_ id: String) {
        guard selectedID != id else { return }
        selectedID = id
        onSelect?(id)
    }

    private func setFrame(_ frame: CGRect, of id: String) {
        guard let index = pictures.firstIndex(where: { $0.id == id }) else { return }
        pictures[index].frame = frame
    }

    private func finishGesture() {
        defer { gesture = nil }
        let start: CGRect
        let id: String
        switch gesture {
        case .move(let i, let s), .pinch(let i, let s): (id, start) = (i, s)
        case .resize(let i, _, let s, _): (id, start) = (i, s)
        case nil: return
        }
        if pictures.first(where: { $0.id == id })?.frame != start { onCommit?(pictures) }
    }

    // MARK: - Drawing

    private var selectedFrame: CGRect? {
        guard arranging, let selectedID else { return nil }
        return pictures.first { $0.id == selectedID }?.frame
    }

    /// The handle under a point: a box twice the handle's size around where
    /// it is drawn — a finger is bigger than the dot.
    func handleCorner(at point: CGPoint) -> PictureCorner? {
        guard let frame = selectedFrame else { return nil }
        let reach = Self.handleSide * chromeScale
        return PictureCorner.allCases.first { corner in
            let center = handleCenter(of: corner, in: frame)
            return abs(point.x - center.x) <= reach && abs(point.y - center.y) <= reach
        }
    }

    private func handleCenter(of corner: PictureCorner, in frame: CGRect) -> CGPoint {
        PagePictures.handleCenter(
            of: corner, in: frame, pageSize: bounds.size, radius: Self.handleSide / 2 * chromeScale)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        aboveInk.frame = bounds
        chrome.frame = bounds
        guard let frame = selectedFrame else {
            chrome.isHidden = true
            return
        }
        chrome.isHidden = false
        outline.strokeColor = tintColor.cgColor
        outline.lineWidth = 2 * chromeScale
        outline.path = UIBezierPath(rect: frame).cgPath
        let scale = CGAffineTransform(scaleX: chromeScale, y: chromeScale)
        for (corner, handle) in handles {
            handle.layer.borderColor = tintColor.cgColor
            handle.transform = scale
            handle.center = handleCenter(of: corner, in: frame)
        }
        // Side by side above the picture, or inside its top edge when it
        // touches the page top: delete, then the … menu.
        let lift = (Self.deleteSide / 2 + 10) * chromeScale
        let above = frame.minY - lift
        let y = above >= lift / 2 ? above : frame.minY + lift
        let spread = (Self.deleteSide / 2 + 6) * chromeScale
        deleteButton.transform = scale
        deleteButton.center = CGPoint(x: frame.midX - spread, y: y)
        let selectedAbove = pictures.first { $0.id == selectedID }?.aboveInk ?? false
        var more = moreButton.configuration ?? .filled()
        more.baseBackgroundColor = tintColor
        moreButton.configuration = more
        moreButton.accessibilityLabel = moreLabel
        moreButton.menu = UIMenu(children: [
            UIAction(
                title: selectedAbove ? underInkLabel : overInkLabel,
                image: UIImage(
                    systemName: selectedAbove
                        ? "square.2.layers.3d.bottom.filled" : "square.2.layers.3d.top.filled")
            ) { [weak self] _ in self?.toggleSelectedInkSide() }
        ])
        moreButton.transform = scale
        moreButton.center = CGPoint(x: frame.midX + spread, y: y)
    }

    override func tintColorDidChange() {
        super.tintColorDidChange()
        setNeedsLayout()
    }
}
