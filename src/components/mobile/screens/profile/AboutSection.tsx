import { EyMark } from '../../../brand/EyMark';
import { useTranslation } from '../../../../hooks/useTranslation';
import { getAppVersion } from '../../../../utils/appIdentity';

/**
 * Who made reIS, which build this is, and who reIS works with — at the foot of
 * Profil, in the open.
 *
 * It was a sheet behind an "O aplikaci" row for about an hour. Wrong: a credit
 * that has to be opened is a credit nobody reads, and the version number is
 * most wanted by a student who is already writing a bug report and should not
 * have to go hunting for it. Everything here is three short lines; a whole
 * surface to hold them was ceremony.
 *
 * The foot of the settings list is still the right PLACE, though, for the same
 * reason the sheet was: this is where someone looks to find out who makes the
 * thing and how it is paid for. The same words on the calendar would be an
 * interruption, and on the welcome screen — where the student is deciding
 * whether to trust reIS with an IS session — they would read as "who else is
 * getting my data?".
 *
 * Reach is not the point. Stating the rule once, in public, while the stakes
 * are nil is: when company events and internship deadlines eventually flow
 * into Novinky, they arrive against a policy that was already written down,
 * instead of looking like the week reIS started selling ads.
 */
export function AboutSection() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 px-4 pb-2 pt-4">
      <div className="flex flex-col gap-0.5">
        <span data-testid="about-version" className="text-2sm font-bold text-base-content/70">
          reIS {getAppVersion()}
        </span>
        {/* The welcome screen's own line, reused rather than reworded: it is the
            same product and it already says who built it and why. */}
        <span className="whitespace-pre-line text-2sm text-base-content/60">
          {t('onboarding.description')}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('about.partnersLabel')}
        </span>
        <p className="text-2sm leading-relaxed text-base-content/60">{t('about.partnersBody')}</p>
        {/* No card, no plate, no link. A container turns a mark into a
            placement, and a credit that asks for something is an advert. When
            there are real opportunities they will link to the opportunity,
            never to a corporate homepage. */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <EyMark className="h-4 text-base-content/70" />
          <span className="text-2sm text-base-content/60">{t('about.eyBody')}</span>
        </div>
      </div>
    </div>
  );
}
