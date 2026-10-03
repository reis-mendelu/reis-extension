import PDFKit
import UIKit

/**
 * "Vyzkoušet se": the file's covers one at a time, in reading order. Tap the
 * cover (or Ukázat) to look, then Znám or Ještě ne. Each answer is saved at
 * once as a `CoverReview` on that cover; nothing else about the test is kept.
 *
 * Not a mode for the Pencil: it still draws, because writing the answer before
 * looking is the point. The controls are in the bar, where the floating tool
 * picker can never sit over them. Ukončit is trailing, so the leading group
 * (the exit beside the split view's toggle, see `exitItem`) is never touched.
 */
@available(iOS 16.0, *)
extension PdfInkViewController {
    func makeRecallItem(_ title: String, _ action: Selector) -> UIBarButtonItem {
        let item = UIBarButtonItem(title: title, style: .plain, target: self, action: action)
        item.tintColor = tint
        return item
    }

    func updateRecallItem() {
        recallItem.isHidden = document == nil || !hasCovers
    }

    @objc func recallTapped() { startRecall() }
    @objc func revealTapped() { revealCurrentCover() }
    @objc func knewTapped() { answerRecall(knew: true) }
    @objc func notYetTapped() { answerRecall(knew: false) }
    @objc func endRecallTapped() { endRecall() }

    /// Starts over the file's covers, or over just `ids` (the retry). False
    /// when there is nothing to ask.
    @discardableResult
    func startRecall(only ids: Set<String>? = nil) -> Bool {
        guard let session = RecallSession(covers: covers, only: ids) else { return false }
        endArrangingPictures(restoringPens: false)
        putTapeDown()
        recall = session
        titleBeforeRecall = titleBeforeRecall ?? title
        revealedCovers = []
        refreshCoverLayers()
        showToolPicker()
        showRecallStep()
        return true
    }

    /// A test is for writing answers: with the tape in hand the Pencil would
    /// make covers and a tap would take the one being asked away.
    private func putTapeDown() {
        guard #available(iOS 18.0, *), CoverTool.isSelected(in: toolPicker) else { return }
        toolPicker.selectedToolItemIdentifier = "com.apple.ink.pen"
        coverToolDidChange()
    }

    func showRecallStep() {
        guard let session = recall else { return }
        guard let step = session.current else { return finishRecall() }
        title = PdfInkStrings.fill(
            strings.recallProgress, ["n": session.number, "total": session.total])
        navigationItem.rightBarButtonItems = [endRecallItem, revealItem]
        for (index, overlay) in overlays {
            overlay.coverLayer.currentID = index == step.page ? step.id : nil
        }
        scroll(to: step)
    }

    func revealCurrentCover() {
        guard let step = recall?.current else { return }
        revealedCovers.insert(step.id)
        overlays[step.page]?.coverLayer.revealed = revealedCovers
        currentCoverOpened()
    }

    /// Called from `toggleCover` too: tapping the cover is the same as Ukázat.
    func currentCoverOpened() {
        navigationItem.rightBarButtonItems = [endRecallItem, knewItem, notYetItem]
    }

    func answerRecall(knew: Bool) {
        guard var session = recall, let answered = session.answer(knew: knew, at: now()) else {
            return
        }
        recall = session
        let step = answered.step
        if var list = covers[step.page], let i = list.firstIndex(where: { $0.id == step.id }) {
            list[i].reviews.append(answered.review)
            setCovers(list, onPage: step.page, registeringUndo: false)
        }
        showRecallStep()
    }

    /// The score, and the retry when anything was Ještě ne.
    private func finishRecall() {
        guard let session = recall else { return }
        navigationItem.rightBarButtonItems = [endRecallItem]
        for overlay in overlays.values { overlay.coverLayer.currentID = nil }
        let alert = UIAlertController(
            title: PdfInkStrings.fill(
                strings.recallScore, ["known": session.knownCount, "total": session.total]),
            message: nil, preferredStyle: .alert)
        let notYet = session.notYetIDs
        if !notYet.isEmpty {
            alert.addAction(
                UIAlertAction(title: strings.recallRetry, style: .default) { [weak self] _ in
                    self?.endRecall(restoringPens: false)
                    self?.startRecall(only: notYet)
                })
        }
        alert.addAction(
            UIAlertAction(title: strings.done, style: .cancel) { [weak self] _ in
                self?.endRecall()
            })
        if let tint { alert.view.tintColor = tint }
        present(alert, animated: true)
    }

    /// Every way out: Ukončit, Hotovo, a file switch, closing. Answers already
    /// given are saved; every cover is shut again.
    func endRecall(restoringPens: Bool = true) {
        guard recall != nil else { return }
        recall = nil
        if let titleBeforeRecall { title = titleBeforeRecall }
        titleBeforeRecall = nil
        revealedCovers = []
        for overlay in overlays.values { overlay.coverLayer.currentID = nil }
        refreshCoverLayers()
        navigationItem.rightBarButtonItems = fileToolItems
        updateRecallItem()
        if restoringPens { showToolPicker() }
    }

    /// The cover's page first, then — once PDFKit has laid that page's overlay
    /// out — the cover itself with some room around it. Converting through the
    /// overlay lets PDFKit handle rotation and crop boxes.
    private func scroll(to step: RecallStep) {
        guard let page = document?.page(at: step.page) else { return }
        pdfView.go(to: page)
        DispatchQueue.main.async { [weak self] in
            guard let self, let overlay = self.overlays[step.page],
                let cover = self.covers[step.page]?.first(where: { $0.id == step.id })
            else { return }
            let inView = overlay.convert(cover.rect.insetBy(dx: -48, dy: -48), to: self.pdfView)
            self.pdfView.go(to: self.pdfView.convert(inView, to: page), on: page)
        }
    }
}
