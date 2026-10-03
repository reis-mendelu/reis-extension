import PDFKit
import PencilKit
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/**
 * Pictures on the page: the `+` menu, the photo picker and the camera, and the
 * arranging mode (spec addendum 2026-10-03).
 *
 * Arranging is a visible mode, like the withdrawn covers were: the pens go, the
 * bar is one Done, and the canvases stop taking touches so a finger moves
 * pictures instead of drawing. Every change goes through `setPictures`, which is
 * the only writer — it shows, saves and registers the way back on the same undo
 * manager PencilKit uses, so the palette's undo takes back the last thing done.
 */
@available(iOS 16.0, *)
extension PdfInkViewController: PHPickerViewControllerDelegate,
    UIImagePickerControllerDelegate, UINavigationControllerDelegate
{
    // MARK: - Menu

    /// Three sections with dividers: a page, a picture, editing the pictures.
    /// Apple's own verbs (Notes: "Choose Photo", "Take Photo") rather than
    /// fragments — the first build's flat "Z fotek / Přesunout obrázky" list
    /// read as odd. Editing is offered only once the file has a picture.
    func addMenuItems() -> [UIMenuElement] {
        let page = UIAction(title: strings.addPage, image: UIImage(systemName: "doc.badge.plus")) {
            [weak self] _ in self?.addBlankPage()
        }
        var picture: [UIMenuElement] = [
            UIAction(title: strings.photoLibrary, image: UIImage(systemName: "photo.on.rectangle")) {
                [weak self] _ in self?.presentPhotoPicker()
            }
        ]
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picture.append(
                UIAction(title: strings.takePhoto, image: UIImage(systemName: "camera")) {
                    [weak self] _ in self?.presentCamera()
                })
        }
        picture.append(
            UIAction(title: strings.chooseFile, image: UIImage(systemName: "folder")) {
                [weak self] _ in self?.presentFilePicker()
            })
        var sections = [section([page]), section(picture)]
        if pictures.values.contains(where: { !$0.isEmpty }) {
            sections.append(
                section([
                    UIAction(
                        title: strings.movePictures,
                        image: UIImage(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                    ) { [weak self] _ in self?.arrangePicturesOnPageOnScreen() }
                ]))
        }
        return sections
    }

    /// An inline group: UIKit draws a divider between neighbouring ones.
    private func section(_ children: [UIMenuElement]) -> UIMenu {
        UIMenu(title: "", options: .displayInline, children: children)
    }

    // MARK: - Picking

    /// No photo-library permission: PHPicker runs out of process and hands
    /// over only what the student picked.
    func presentPhotoPicker() {
        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        presentPicking(picker)
    }

    /// The capture goes onto the page and nowhere else — never into the photo
    /// library, which would need a second permission.
    func presentCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return }
        let camera = UIImagePickerController()
        camera.sourceType = .camera
        camera.delegate = self
        camera.modalPresentationStyle = .fullScreen
        presentPicking(camera)
    }

    /// The photo pickers are dismissed in code, which `presentationControllerDidDismiss`
    /// never hears about — so a cancel gives the pens back itself, and a pick
    /// goes on to arranging. A swipe-away still reaches the delegate.
    func presentPicking(_ controller: UIViewController) {
        controller.presentationController?.delegate = self
        if let tint { controller.view.tintColor = tint }
        beginPicking()
        present(controller, animated: true)
    }

    /// Pens away until the pick ends. Every way out goes through
    /// `showToolPicker()` (cancel, failure, swipe-away) or
    /// `beginArrangingPictures` (a pick), and both clear the flag.
    func beginPicking() {
        pickingPicture = true
        pickingFor = inkURL
        putPensAway()
    }

    /// Stops waiting for a pick without taking the responder (a file switch).
    func endPicking() {
        guard pickingPicture else { return }
        pickingPicture = false
        pickingFor = nil
        setPagePens(visible: true)
    }

    /**
     * Hides the pens and lets the responder go.
     *
     * `setVisible(false)` alone is not enough: PencilKit re-reads it when the
     * responder changes, and the photo picker runs out of process and takes no
     * responder — the pens stayed over it on the simulator. The search sheet
     * never showed this only because its field takes the responder. Done, a
     * cancel or a dismissal takes it back through `showToolPicker()`.
     */
    private func putPensAway() {
        setPagePens(visible: false)
        for overlay in overlays.values where overlay.canvas.isFirstResponder {
            overlay.canvas.resignFirstResponder()
        }
        pdfView.resignFirstResponder()
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider,
            provider.hasItemConformingToTypeIdentifier(UTType.image.identifier)
        else { return showToolPicker() }
        provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) {
            [weak self] data, error in
            let picture = data.flatMap { PictureIngest.picture(from: $0) }
            DispatchQueue.main.async { self?.finishPicking(picture, error: error) }
        }
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)
        let image = info[.originalImage] as? UIImage
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let picture = image.flatMap { PictureIngest.picture(from: $0) }
            DispatchQueue.main.async { self?.finishPicking(picture, error: nil) }
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        showToolPicker()
    }

    /// `target` is the file the pick started in: a photo can take seconds to
    /// load, and one that arrives after a file switch belongs to neither file.
    func finishPicking(_ picture: PictureIngest.Picture?, error: Error?, for target: URL?) {
        guard target == inkURL else {
            NSLog("PdfInk: a picked photo arrived after a file switch; dropped")
            return
        }
        if let picture, insertPicture(picture) { return }
        NSLog("PdfInk: picture could not be placed (\(String(describing: error)))")
        showToolPicker()
    }

    private func finishPicking(_ picture: PictureIngest.Picture?, error: Error?) {
        finishPicking(picture, error: error, for: pickingFor)
    }

    // MARK: - Placing

    /// On the page on screen, centred on the part of it that is visible, and
    /// selected — the next thing a student does with a new picture is put it
    /// where it belongs.
    @discardableResult
    func insertPicture(_ picture: PictureIngest.Picture) -> Bool {
        guard let document, let page = pdfView.currentPage else { return false }
        let index = document.index(for: page)
        let pageSize = InkPages.displayedSize(of: page)
        let middle = CGPoint(x: pdfView.bounds.midX, y: pdfView.bounds.midY)
        let center = overlays[index].map { $0.convert(middle, from: pdfView) }
            ?? CGPoint(x: pageSize.width / 2, y: pageSize.height / 2)
        let placed = PagePicture(
            id: UUID().uuidString,
            frame: PagePictures.initialFrame(
                imageSize: picture.pixelSize, pageSize: pageSize, around: center),
            jpeg: picture.jpeg)
        setPictures((pictures[index] ?? []) + [placed], onPage: index)
        beginArrangingPictures(selecting: (index, placed.id))
        NSLog("PdfInk: picture placed on page \(index), \(picture.jpeg.count) bytes")
        return true
    }

    /// The one writer. Shows the list, saves at once (a picture is placed far
    /// less often than a stroke is drawn), and registers its own reverse.
    func setPictures(_ list: [PagePicture], onPage index: Int) {
        let before = pictures[index] ?? []
        guard list != before else { return }
        pictures[index] = list.isEmpty ? nil : list
        overlays[index]?.pictureLayer.pictures = list
        if let selected = selectedPicture, selected.page == index,
            !list.contains(where: { $0.id == selected.id })
        {
            selectPicture(nil)
        }
        undoManagerForPictures?.registerUndo(withTarget: pictureUndoTarget) { [weak self] _ in
            self?.setPictures(before, onPage: index)
        }
        persistNow()
    }

    /// PencilKit's: the window's, reached from the page.
    var undoManagerForPictures: UndoManager? { pdfView.undoManager }

    /// Page indices under registered picture undos are stale after a page is
    /// added or removed, or the file changes.
    func forgetPictureUndo() {
        undoManagerForPictures?.removeAllActions(withTarget: pictureUndoTarget)
    }

    // MARK: - Arranging

    func beginArrangingPictures(selecting selection: (page: Int, id: String)? = nil) {
        arrangingPictures = true
        pickingPicture = false
        selectedPicture = selection
        putPensAway()
        navigationItem.rightBarButtonItems = [doneArrangingItem]
        emptyPageTap.isEnabled = true
        for (index, overlay) in overlays { applyPictureMode(to: overlay, page: index) }
    }

    /// "Edit pictures": arranging with the top picture on the page on screen
    /// selected, so it is plain what will move. A page with none selects nothing.
    func arrangePicturesOnPageOnScreen() {
        let index = document.flatMap { document in
            pdfView.currentPage.map { document.index(for: $0) }
        }
        let top = index.flatMap { pictures[$0]?.last }
        beginArrangingPictures(selecting: index.flatMap { i in top.map { (i, $0.id) } })
    }

    /// The page's pens come back on every exit; `restoringPens` only decides
    /// whether the page takes the responder now (not when a file is closing).
    func endArrangingPictures(restoringPens: Bool = true) {
        guard arrangingPictures else { return }
        arrangingPictures = false
        selectedPicture = nil
        navigationItem.rightBarButtonItems = fileToolItems
        emptyPageTap.isEnabled = false
        for (index, overlay) in overlays { applyPictureMode(to: overlay, page: index) }
        if restoringPens { showToolPicker() } else { setPagePens(visible: true) }
    }

    @objc func doneArrangingTapped() { endArrangingPictures() }

    /// Empty page ends arranging; a tap the picture layer takes does not.
    @objc func emptyPageTapped(_ tap: UITapGestureRecognizer) {
        guard arrangingPictures, tap.state == .ended else { return }
        for overlay in overlays.values
        where overlay.pictureLayer.takesTouch(at: tap.location(in: overlay.pictureLayer)) {
            return
        }
        endArrangingPictures()
    }

    func selectPicture(_ selection: (page: Int, id: String)?) {
        selectedPicture = selection
        for (index, overlay) in overlays {
            overlay.pictureLayer.selectedID = selection?.page == index ? selection?.id : nil
        }
    }

    /// Called for every overlay PDFKit asks for — so a page that scrolls in
    /// while arranging is not drawable either.
    func configurePictures(of overlay: PageOverlayView, page index: Int) {
        let layer = overlay.pictureLayer
        layer.pictures = pictures[index] ?? []
        layer.deleteLabel = strings.deletePicture
        layer.underInkLabel = strings.underInk
        layer.overInkLabel = strings.overInk
        addPickUpTap(to: overlay)
        layer.chromeScale = pictureChromeScale
        layer.onSelect = { [weak self] id in self?.selectPicture((index, id)) }
        layer.onCommit = { [weak self] list in self?.setPictures(list, onPage: index) }
        applyPictureMode(to: overlay, page: index)
    }

    func applyPictureMode(to overlay: PageOverlayView, page index: Int) {
        overlay.canvas.isUserInteractionEnabled = !arrangingPictures
        overlay.pictureLayer.arranging = arrangingPictures
        overlay.pictureLayer.selectedID =
            selectedPicture?.page == index ? selectedPicture?.id : nil
    }

    var pictureChromeScale: CGFloat { 1 / max(pdfView.scaleFactor, 0.01) }

    func canvas(onPage index: Int) -> PKCanvasView? { overlays[index]?.canvas }
}
