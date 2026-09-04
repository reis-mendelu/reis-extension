import { EyMark } from '../../../brand/EyMark';
import { useTranslation } from '../../../../hooks/useTranslation';
import { getAppVersion } from '../../../../utils/appIdentity';

/**
 * Who made reIS, which build this is, and who reIS works with — at the foot of
 * Profil, in the open.
 *
 * It was a sheet behind an "O aplikaci" row for about an hour. Wrong: a credit
 * that has to be opened is a credit nobody reads, and the version number is
 * most wanted by a student already writing a bug report, who should not have to
 * go hunting for it.
 *
 * The foot of the settings list is still the right PLACE: this is where someone
 * looks to find out who makes the thing and how it is paid for. The same words
 * on the calendar would be an interruption, and on the welcome screen — where
 * the student is deciding whether to trust reIS with an IS session — they would
 * read as "who else is getting my data?".
 *
 * CENTRED, and set at the same size as the settings rows above rather than in
 * fine print. Left-aligned and one step down it read as a legal footer — the
 * thing an eye is trained to skip — which is a poor way to present a sentence
 * that exists precisely to be read ("Nevidí žádná data z tvého ISu"). Centred,
 * it reads as a colophon: the end of the page, deliberately.
 *
 * The paragraph is measure-capped rather than full-bleed: centred text with a
 * long line has two ragged edges and no anchor for the eye to return to.
 *
 * Reach is not the point. Stating the rule once, in public, while the stakes
 * are nil is: when company events and internship deadlines eventually flow into
 * Novinky, they arrive against a policy already written down, instead of
 * looking like the week reIS started selling ads.
 */
export function AboutSection() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-5 px-4 pb-4 pt-6 text-center">
      <div className="flex flex-col gap-1">
        <span data-testid="about-version" className="text-md font-bold text-base-content">
          reIS {getAppVersion()}
        </span>
        {/* The welcome screen's own line, reused rather than reworded: it is the
            same product and it already says who built it and why. */}
        <span className="whitespace-pre-line text-sm text-base-content/60">
          {t('onboarding.description')}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('about.partnersLabel')}
        </span>
        <p className="max-w-[19rem] text-sm leading-relaxed text-base-content/60">
          {t('about.partnersBody')}
        </p>
        {/* No card, no plate, no link. A container turns a mark into a
            placement, and a credit that asks for something is an advert. When
            there are real opportunities they will link to the opportunity,
            never to a corporate homepage.
            The mark is set to the cap height of the line beside it rather than
            shrunk into a footnote — it is a partner's name, and naming someone
            in type smaller than your own settings labels is its own statement. */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <EyMark className="h-7 text-base-content" />
          <span className="text-sm text-base-content/60">{t('about.eyBody')}</span>
        </div>
      </div>
    </div>
  );
}
