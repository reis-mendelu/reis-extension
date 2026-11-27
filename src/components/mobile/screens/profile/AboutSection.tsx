import { PartnersBlock } from '../../../Partners/PartnersBlock';

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
 * whole block is kept tight: Profil is budgeted to fit without scrolling where
 * it can, and in landscape (1080×810 on an iPad 8) every line this paragraph
 * wraps to pushes the list's last row toward the nav. The map-app reset row
 * above appears only once a choice has been remembered, and its ~40px is paid
 * for here — out of the block that was added last — rather than out of the
 * settings the student came for.
 *
 * Reach is not the point of the block. Stating the rule once, in public, while
 * the stakes are nil is: when company events and internship deadlines
 * eventually flow into Novinky, they arrive against a policy already written
 * down, instead of looking like the week reIS started selling ads.
 */
export function AboutSection() {
  // Hidden on a short screen. Profil scrolls (its own scroller, with a fade
  // while more is below), but the rows are budgeted to fit a typical student
  // without it: at 375×667 (iPhone SE, still shipping) they fit with 15–23px
  // to spare (measured 2026-11-27), and this block would push them past the
  // fold. A colophon is the one thing on this screen that can stand down; the
  // settings are what the student came for. From 780px up it stays, and there
  // it does not always fit: on a 375×812 mini the partner block puts the last
  // row 29px under the nav, which the scroll and the fade cover.
  //
  // Which partners, if any, is the student's field (spec 2026-10-09); the
  // block renders nothing for a field without one. No card, no plate, no link:
  // a container turns a mark into a placement, and a credit that asks for
  // something is an advert.
  return <PartnersBlock className="[@media(max-height:779px)]:hidden px-4 pb-1 pt-2" />;
}
