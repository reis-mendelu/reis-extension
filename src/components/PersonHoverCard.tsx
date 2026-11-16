import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { fetchPersonProfile } from '../api/search/searchService';
import { useAppStore } from '../store/useAppStore';
import { logError } from '../utils/reportError';
import { usePersonPhoto } from '../hooks/data/usePersonPhoto';
import { PersonHoverCardBody } from './PersonHoverCardBody';
import { PersonPhotoLightbox } from './ui/PersonPhotoLightbox';
import type { Person } from '../api/search/types';

interface PersonHoverCardProps {
  personId: string;
  children: React.ReactNode;
  /** Optional href for the wrapper anchor — pass through to avoid double <a> nesting */
  href?: string;
  className?: string;
}

interface CardPosition {
  top: number;
  left: number;
  flip: boolean;
}

const HOVER_DELAY_MS = 450;
const CARD_WIDTH = 360;

const CARD_ESTIMATED_HEIGHT = 90;

function computePosition(anchor: DOMRect): CardPosition {
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const flip = spaceBelow < 200 && spaceAbove > spaceBelow;

  let left = anchor.left;
  if (left + CARD_WIDTH > window.innerWidth - 12) {
    left = window.innerWidth - CARD_WIDTH - 12;
  }

  // Use viewport-relative coords directly since we're using position:fixed
  return {
    top: flip ? anchor.top - CARD_ESTIMATED_HEIGHT - 6 : anchor.bottom + 6,
    left,
    flip,
  };
}

export function PersonHoverCard({ personId, children, className }: PersonHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [profile, setProfile] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<CardPosition | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const isTouch = useAppStore((s) => s.isTouch);
  // The id the avatar shows, cached for the session: enlarging fetches nothing.
  // Only while the card or the photo is open: a card nobody opens asks IS for nothing.
  const photoId = profile?.id || (/^\d+$/.test(personId) ? personId : null);
  const photo = usePersonPhoto(visible || zoomed ? photoId : null);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const cancelTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const openCard = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos(computePosition(rect));
    setVisible(true);

    // Lazy-fetch profile if not yet loaded
    if (!profile && !loading) {
      setLoading(true);
      fetchPersonProfile(personId)
        .then((p: Person | null) => {
          setProfile(p);
          setLoading(false);
        })
        .catch((err: unknown) => {
          // Clear loading so the next open re-attempts the fetch instead
          // of being stuck on a permanent spinner.
          setLoading(false);
          logError('PersonHoverCard.fetchProfile', err, { personId });
        });
    }
  }, [personId, profile, loading]);

  const handleMouseEnter = useCallback(() => {
    cancelTimers();
    hoverTimer.current = setTimeout(openCard, HOVER_DELAY_MS);
  }, [openCard]);

  const handleMouseLeave = useCallback(() => {
    cancelTimers();
    leaveTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  const handleTouchClick = useCallback(() => {
    cancelTimers();
    if (visible) {
      setVisible(false);
    } else {
      openCard();
    }
  }, [visible, openCard]);

  // Keep card open while hovering the card itself
  const handleCardEnter = () => {
    cancelTimers();
  };
  const handleCardLeave = () => {
    cancelTimers();
    leaveTimer.current = setTimeout(() => setVisible(false), 150);
  };

  useEffect(() => () => cancelTimers(), []);

  // Touch users have no hover-leave; without an outside-tap dismiss the card
  // sticks on screen until the same anchor is tapped again. Listen on the
  // document while open and close when the tap lands outside both surfaces.
  useEffect(() => {
    if (!isTouch || !visible) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      if (cardRef.current?.contains(target)) return;
      setVisible(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [isTouch, visible]);

  // The photo takes the screen and the card steps aside. The lightbox lives
  // outside the card's AnimatePresence below: the cursor landing on the overlay
  // fires the card's mouseleave, and a lightbox inside the card would go with it.
  const enlarge = () => {
    cancelTimers();
    setVisible(false);
    setZoomed(true);
  };

  const card = (
    <AnimatePresence>
      {visible && pos && (
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: pos.flip ? 4 : -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.flip ? 4 : -4, scale: 0.97 }}
          transition={{ duration: 0.13, ease: 'easeOut' }}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: CARD_WIDTH,
            zIndex: 9999,
          }}
          className="bg-base-100 border border-base-300 rounded-2xl shadow-popover-heavy p-4 flex items-center gap-4"
        >
          <PersonHoverCardBody
            personId={personId}
            profile={profile}
            loading={loading}
            photo={photo}
            onEnlarge={enlarge}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={isTouch ? undefined : handleMouseEnter}
        onMouseLeave={isTouch ? undefined : handleMouseLeave}
        onClick={isTouch ? handleTouchClick : undefined}
        className={className}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && createPortal(card, document.body)}
      <PersonPhotoLightbox
        src={zoomed ? photo : null}
        alt={profile?.name ?? ''}
        onClose={() => setZoomed(false)}
      />
    </>
  );
}
