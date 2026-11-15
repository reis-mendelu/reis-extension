import { Mail, ExternalLink, UserRound } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { isPersonProfileUrl } from '../utils/isPersonProfileUrl';
import type { Person } from '../api/search/types';

interface PersonHoverCardBodyProps {
  personId: string;
  profile: Person | null;
  loading: boolean;
  /** The resolved photo, or null while it loads or when IS has none. */
  photo: string | null;
  onEnlarge: () => void;
}

/** What the hover card shows: avatar, name, faculty, e-mail, and two links. */
export function PersonHoverCardBody({
  personId,
  profile,
  loading,
  photo,
  onEnlarge,
}: PersonHoverCardBodyProps) {
  const { t, language } = useTranslation();
  const email = profile?.email;
  const messageUrl = email
    ? `https://is.mendelu.cz/auth/posta/nova_zprava.pl?komu=${encodeURIComponent(email)}`
    : null;

  return (
    <>
      {/* A button only once there is a photo: the glyph enlarged is nothing.
          stopPropagation: on touch the anchor under this portal toggles the card. */}
      <button
        type="button"
        disabled={!photo}
        aria-label={photo ? t('common.enlargePhoto') : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onEnlarge();
        }}
        className="avatar flex-shrink-0 rounded-full cursor-zoom-in disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-2 ring-offset-base-100 overflow-hidden">
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover scale-[1.05]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral text-neutral-content">
              <UserRound size={24} strokeWidth={1.5} />
            </div>
          )}
        </div>
      </button>

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
              <span className="text-xs text-base-content/50 leading-tight">{profile.faculty}</span>
            )}
            {email && (
              <span className="text-xs text-base-content/40 font-mono break-all">{email}</span>
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
            onClick={(e) => e.stopPropagation()}
          >
            <Mail size={16} />
          </a>
        )}
        <a
          href={isPersonProfileUrl(personId, language)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-primary hover:bg-primary/10"
          title="Open profile"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </>
  );
}
