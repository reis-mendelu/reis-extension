import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { EyMark } from '../../brand/EyMark';
import { useTranslation } from '../../../hooks/useTranslation';
import { getAppVersion } from '../../../utils/appIdentity';

export interface AboutSheetProps {
  onClose: () => void;
}

/**
 * Who made reIS, which build this is, and who reIS works with.
 *
 * The app had no About surface at all — no version, no authors, no credits — so
 * a student reporting a bug could not say which build they were on, and there
 * was nowhere a partner credit could go without landing in somebody's way.
 *
 * That absence is why the partner block belongs HERE rather than anywhere with
 * more traffic. Someone who opens "O aplikaci" is asking who makes this and how
 * it is paid for; answering that question is content. The same words on the
 * calendar would be an interruption, and on the welcome screen — where the
 * student is deciding whether to trust reIS with an IS session — they would
 * read as "who else is getting my data?".
 *
 * Reach is not the point of this page. Stating the rule once, in public, while
 * the stakes are nil is: when company events and internship deadlines
 * eventually flow into Novinky, they arrive against a policy that was already
 * written down, instead of looking like the week reIS started selling ads.
 */
export function AboutSheet({ onClose }: AboutSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('about.title')} onClose={onClose} />
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="flex flex-col gap-1">
          <span data-testid="about-version" className="text-md font-bold text-base-content">
            reIS {getAppVersion()}
          </span>
          {/* The welcome screen's own line, reused rather than reworded: it is
              the same product and it already says who built it and why. */}
          <span className="whitespace-pre-line text-2sm text-base-content/60">
            {t('onboarding.description')}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
            {t('about.partnersLabel')}
          </span>
          <p className="text-2sm leading-relaxed text-base-content/70">{t('about.partnersBody')}</p>

          {/* No card, no plate, no link. A container is what turns a mark into
              a placement, and a credit that asks for something is an advert.
              When there are real opportunities they will link to the
              opportunity, never to a corporate homepage. */}
          <div className="flex items-center gap-3 pt-1">
            <EyMark className="h-5 text-base-content" />
            <span className="text-2sm text-base-content/60">{t('about.eyBody')}</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
