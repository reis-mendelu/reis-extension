import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ExternalLink, UserRound } from 'lucide-react';
import { fetchPersonProfile } from '../api/search/searchService';
import { useAppStore } from '../store/useAppStore';
import { logError } from '../utils/reportError';
import { PersonPhoto } from './ui/PersonPhoto';
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

const PROFILE_BASE = 'https://is.mendelu.cz/auth/lide/clovek.pl';
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
        top: flip
            ? anchor.top - CARD_ESTIMATED_HEIGHT - 6
            : anchor.bottom + 6,
        left,
        flip,
    };
}

export function PersonHoverCard({ personId, children, className }: PersonHoverCardProps) {
    const [visible, setVisible] = useState(false);
    const [profile, setProfile] = useState<Person | null>(null);
    const [loading, setLoading] = useState(false);
    const [pos, setPos] = useState<CardPosition | null>(null);
    const isTouch = useAppStore((s) => s.isTouch);

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

    const email = profile?.email;
    const messageUrl = email
        ? `https://is.mendelu.cz/auth/posta/nova_zprava.pl?komu=${encodeURIComponent(email)}`
        : null;

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
                    {/* Avatar */}
                    <div className="avatar flex-shrink-0">
                        <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-2 ring-offset-base-100 overflow-hidden">
                            <PersonPhoto
                                personId={profile?.id || (/^\d+$/.test(personId) ? personId : null)}
                                alt=""
                                className="w-full h-full object-cover scale-[1.05]"
                                fallback={
                                    <div className="w-full h-full flex items-center justify-center bg-neutral text-neutral-content">
                                        <UserRound size={24} strokeWidth={1.5} />
                                    </div>
                                }
                            />
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {loading && !profile ? (
                            <div className="space-y-1.5">
                                <div className="h-3.5 bg-base-300 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-base-300 rounded animate-pulse w-1/2" />
                            </div>
                        ) : (
                            <>
                                <span className="font-bold text-sm text-base-content leading-tight">
                                    {profile?.name ?? '—'}
                                </span>
                                {profile?.faculty && (
                                    <span className="text-xs text-base-content/50 leading-tight">
                                        {profile.faculty}
                                    </span>
                                )}
                                {email && (
                                    <span className="text-xs text-base-content/40 font-mono break-all">
                                        {email}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                        {messageUrl && (
                            <a
                                href={messageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-primary hover:bg-primary/10"
                                title="Send message"
                                onClick={e => e.stopPropagation()}
                            >
                                <Mail size={16} />
                            </a>
                        )}
                        <a
                            href={`${PROFILE_BASE}?id=${personId};lang=cz`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-primary hover:bg-primary/10"
                            title="Open profile"
                            onClick={e => e.stopPropagation()}
                        >
                            <ExternalLink size={14} />
                        </a>
                    </div>
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
        </>
    );
}
