import UIKit

/// The line that says what the tape is for (`TapeHintView`).
@available(iOS 16.0, *)
extension PdfInkViewController {
    /// Long enough to read two short sentences, short enough not to sit there.
    static let tapeHintSeconds: TimeInterval = 6

    func installTapeHint() {
        tapeHint.text = strings.tapeHint
        tapeHint.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tapeHint)
        let wide = tapeHint.widthAnchor.constraint(equalToConstant: 520)
        wide.priority = .defaultHigh
        NSLayoutConstraint.activate([
            tapeHint.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            tapeHint.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            tapeHint.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 16),
            tapeHint.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -16),
            wide,
        ])
    }

    /// Shown while the tape is in hand in a file with no tape yet, for a few
    /// seconds at most.
    func updateTapeHint() {
        let show = makingCovers && !hasCovers
        guard show != !tapeHint.isHidden else { return }
        tapeHint.isHidden = !show
        guard show else { return }
        view.bringSubviewToFront(tapeHint)
        tapeHint.shownAt += 1
        let shown = tapeHint.shownAt
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.tapeHintSeconds) { [weak self] in
            guard let hint = self?.tapeHint, hint.shownAt == shown else { return }
            hint.isHidden = true
        }
    }
}
