console.log('[REIS_LOUD_DEBUG] PersonHoverCard bundle loaded');
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ExternalLink } from 'lucide-react';
import { fetchPersonProfile } from '../api/search/searchService';
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

const PHOTO_BASE = 'https://is.mendelu.cz/auth/lide/foto.pl';
const PROFILE_BASE = 'https://is.mendelu.cz/auth/lide/clovek.pl';
const HOVER_DELAY_MS = 200;
const CARD_WIDTH = 360;

/** Returns the photo URL for any IS person by their numeric ID */
function photoUrl(id: string) {
    return `${PHOTO_BASE}?id=${id};lang=cz`;
}

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

    const anchorRef = useRef<HTMLSpanElement>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const cancelTimers = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };

    const handleMouseEnter = useCallback(() => {
        console.log('[REIS_LOUD_DEBUG] Mouse enter PersonHoverCard', personId);
        cancelTimers();
        hoverTimer.current = setTimeout(() => {
            console.log('[REIS_LOUD_DEBUG] Showing card for', personId);
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            setPos(computePosition(rect));
            setVisible(true);

            // Lazy-fetch profile if not yet loaded
            if (!profile && !loading) {
                setLoading(true);
                fetchPersonProfile(personId).then((p: Person | null) => {
                    setProfile(p);
                    setLoading(false);
                });
            }
        }, HOVER_DELAY_MS);
    }, [personId, profile, loading]);

    const handleMouseLeave = useCallback(() => {
        cancelTimers();
        leaveTimer.current = setTimeout(() => setVisible(false), 150);
    }, []);

    // Keep card open while hovering the card itself
    const handleCardEnter = () => {
        cancelTimers();
    };
    const handleCardLeave = () => {
        cancelTimers();
        leaveTimer.current = setTimeout(() => setVisible(false), 150);
    };

    useEffect(() => () => cancelTimers(), []);

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
                            {(() => {
                                const isNumeric = /^\d+$/.test(personId);
                                const photoId = profile?.id || (isNumeric ? personId : null);
                                
                                if (!photoId) {
                                    return (
                                        <div className="w-full h-full flex items-center justify-center bg-neutral text-neutral-content">
                                            <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>
                                        </div>
                                    );
                                }

                                return (
                                    <img
                                        src={photoUrl(photoId)}
                                        alt=""
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).parentElement!.innerHTML =
                                                '<div class="w-full h-full flex items-center justify-center bg-neutral text-neutral-content"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\'/><circle cx=\'12\' cy=\'7\' r=\'4\'/></svg></div>';
                                        }}
                                    />
                                );
                            })()}
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
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={className}
            >
                {children}
            </span>
            {typeof document !== 'undefined' && createPortal(card, document.body)}
        </>
    );
}
