import { EyMark } from '../../../brand/EyMark';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * Who reIS works with, at the foot of Profil, in the open.
 *
 * It was a sheet behind an "O aplikaci" row for about an hour. Wrong: a credit
 * that has to be opened is a credit nobody reads. The foot of the settings list
 * is the right place — this is where someone looks to find out who makes the
 * thing and how it is paid for. The same words on the calendar would be an
 * interruption, and on the welcome screen, where the student is deciding
 * whether to trust reIS with an IS session, they would read as "who else is
 * getting my data?".
 *
 * No version line and no "vytvořeno studenty" tagline. The tagline is already
 * the welcome screen's opening sentence, and the version was carried here for
 * bug reports — which never needed it: `ext_version` rides on every feedback
 * and telemetry payload automatically (see api/suggestions.ts), so a report
 * knows the build whether or not the student could see it.
 *
 * Centred, and set at the size of the settings rows above rather than in fine
 * print. Left-aligned and one step down it read as a legal footer — the thing
 * an eye is trained to skip — which is a poor way to present a sentence that
 * exists precisely to be read ("Nevidí žádná data z tvého ISu").
 *
 * The measure widens on a tablet rather than the block growing taller, and the
 * whole block is kept tight: Profil must not scroll, and in landscape
 * (1080×810 on an iPad 8) every line this paragraph wraps to costs the list its
 * last row. The map-app reset row above appears only once a choice has been
 * remembered, and its ~40px is paid for here — out of the block that was added
 * last — rather than out of the settings the student came for.
 *
 * Reach is not the point of the block. Stating the rule once, in public, while
 * the stakes are nil is: when company events and internship deadlines
 * eventually flow into Novinky, they arrive against a policy already written
 * down, instead of looking like the week reIS started selling ads.
 */
export function AboutSection() {
  const { t } = useTranslation();

  return (
    <div // Hidden on a short screen, and this is the rule Profil is held to rather
      // than a nicety: it must not scroll. Measured at 375×667 (iPhone SE, still
      // shipping) the settings fit EXACTLY — 0px over — and this block is what
      // pushes them 70px past the fold, or 106px once the map-app row is there.
      // A colophon is the one thing on this screen that can stand down; the
      // settings are what the student came for. Everything from 780px up keeps
      // it, which is every iPhone since the SE and both iPad orientations.
      className="[@media(max-height:779px)]:hidden flex flex-col items-center gap-1 px-4 pb-1 pt-2 text-center"
    >
      <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
        {t('about.partnersLabel')}
      </span>
      <p className="max-w-[21rem] text-sm leading-snug text-base-content/60 md:max-w-[34rem]">
        {t('about.partnersBody')}
      </p>
      {/* No card, no plate, no link. A container turns a mark into a placement,
          and a credit that asks for something is an advert. When there are real
          opportunities they will link to the opportunity, never to a corporate
          homepage.
          The mark is set to the cap height of the line beside it rather than
          shrunk into a footnote — it is a partner's name, and naming someone in
          type smaller than your own settings labels is its own statement. */}
      <div className="flex items-center justify-center gap-3">
        <EyMark className="h-7 text-base-content" />
        <span className="text-sm text-base-content/60">{t('about.eyBody')}</span>
      </div>
    </div>
  );
}
