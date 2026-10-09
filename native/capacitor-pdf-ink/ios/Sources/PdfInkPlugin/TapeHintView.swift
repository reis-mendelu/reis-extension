import UIKit

/**
 * One line saying what the tape is for, over the top of the page.
 *
 * The palette names the tape and nothing more, and "it's not clear what it's
 * for" (Dominik, 2026-10-09). It shows when the tape is picked in a file with
 * no tape yet, and goes with the first strip, with the tape put down, or after
 * a few seconds. Nothing is stored: a file with tape on it has already
 * answered the question.
 *
 * Touches pass through it: it explains the page, it is not part of it.
 */
final class TapeHintView: UIView {
    private let label = UILabel()
    /// Counts showings, so a timer left from an earlier one hides nothing.
    var shownAt = 0

    var text: String? {
        get { label.text }
        set { label.text = newValue }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isHidden = true
        backgroundColor = .secondarySystemBackground
        layer.cornerRadius = 12
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        resolveBorder()
        // A CGColor does not follow the appearance; re-resolve it when it changes.
        if #available(iOS 17.0, *) {
            registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: TapeHintView, _) in
                view.resolveBorder()
            }
        }
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .label
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
        ])
    }

    required init?(coder: NSCoder) { fatalError("TapeHintView is code-only") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        resolveBorder()
    }

    private func resolveBorder() {
        layer.borderColor = UIColor.separator.resolvedColor(with: traitCollection).cgColor
    }
}
