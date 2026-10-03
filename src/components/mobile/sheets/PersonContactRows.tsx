import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, ExternalLink, Mail, MapPin, UserRound } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ResolvedRoom } from '../../../utils/mobile/resolveRoomCode';

export interface PersonContactRowsProps {
  email: string | null;
  room: ResolvedRoom | null;
  onShowOnMap: () => void;
  /** The person's own page in IS; null when there is no id to open it with. */
  profileUrl: string | null;
}

/**
 * The rows of a person sheet that DO something when tapped: the address
 * copies, the room opens the campus map, and the last row opens the person's
 * page in IS.
 *
 * They share one bordered card so the sheet reads as a short list of things
 * you can do, rather than a paragraph of facts with buttons underneath.
 *
 * The IS row is a plain `target="_blank"` anchor, the way `TeacherList` does
 * it: on Capacitor the capture listener in `mobile/openExternal` turns the tap
 * into the in-app WebView that carries the IS session, and in a browser it is
 * an ordinary new tab. No onClick of its own — that listener runs first, so a
 * second opener would open the page twice.
 */
export function PersonContactRows({
  email,
  room,
  onShowOnMap,
  profileUrl,
}: PersonContactRowsProps) {
  const { t } = useTranslation();
  if (!email && !room && !profileUrl) return null;

  return (
    <div className="divide-y divide-base-200 overflow-hidden rounded-xl border border-base-300">
      {email && <EmailRow email={email} />}
      {room && (
        <button
          type="button"
          onClick={onShowOnMap}
          aria-label={t('mobile.sheet.navigateToRoom', { room: room.label })}
          className={ROW_CLASS}
        >
          <MapPin size={15} className="flex-shrink-0 text-base-content/50" />
          <span className="min-w-0 flex-1 truncate text-sm text-base-content/80">{room.label}</span>
          <ChevronRight size={16} className="flex-shrink-0 text-base-content/30" />
        </button>
      )}
      {profileUrl && (
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
          <UserRound size={15} className="flex-shrink-0 text-base-content/50" />
          <span className="min-w-0 flex-1 truncate text-sm text-base-content/80">
            {t('mobile.sheet.openInIs')}
          </span>
          {/* The arrow out, not a chevron: this row leaves reIS. */}
          <ExternalLink size={14} className="flex-shrink-0 text-base-content/30" />
        </a>
      )}
    </div>
  );
}

/** min-h-12: a row is a touch target before it is a line of text. */
const ROW_CLASS =
  'flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left active:bg-base-200';

function EmailRow({ email }: { email: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the address is on screen and can still be read.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t('mobile.sheet.copyEmail')}
      className={ROW_CLASS}
    >
      <Mail size={15} className="flex-shrink-0 text-base-content/50" />
      <span className="min-w-0 flex-1 truncate text-sm text-base-content/80">{email}</span>
      <span
        className={`flex flex-shrink-0 items-center gap-1 text-xs font-semibold ${
          copied ? 'text-success' : 'text-base-content/40'
        }`}
      >
        {copied ? (
          <>
            <Check size={14} />
            {t('mobile.sheet.copied')}
          </>
        ) : (
          <Copy size={14} />
        )}
      </span>
    </button>
  );
}
