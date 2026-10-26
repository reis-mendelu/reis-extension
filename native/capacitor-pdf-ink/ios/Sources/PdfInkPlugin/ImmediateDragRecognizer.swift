import UIKit
import UIKit.UIGestureRecognizerSubclass

/**
 * A one-touch drag that begins on the first movement.
 *
 * `UIPanGestureRecognizer` waits for the touch to travel about 10 pt before it
 * begins, so the tape's strip appeared late and then jumped under the Pencil —
 * "it feels a bit weird" (Dominik, device, 2026-10-03). A Pencil stroke is
 * deliberate from its first point; the tape should be too. A touch that ends
 * without moving fails, so a tap still reaches the tap recognizer.
 */
final class ImmediateDragRecognizer: UIGestureRecognizer {
    private(set) var startLocation: CGPoint?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard startLocation == nil, touches.count == 1, let touch = touches.first else {
            state = Self.refusing(from: state)
            return
        }
        startLocation = touch.location(in: view)
    }

    /// A touch the stroke cannot take (a second finger). Before the stroke
    /// began it fails, so two fingers never make a strip; after, `.failed` is
    /// not a transition UIKit allows, and the strip growing under the Pencil
    /// stayed on the page. A cancel reaches the layer's handler, which clears it.
    static func refusing(from state: State) -> State {
        state == .possible ? .failed : .cancelled
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        state = state == .possible ? .began : .changed
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        state = state == .possible ? .failed : .ended
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        state = .cancelled
    }

    override func reset() {
        super.reset()
        startLocation = nil
    }
}
