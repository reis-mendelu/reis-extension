/**
 * A notice IS shows on its home page (`/auth/index.pl`), above the menu. IS
 * calls them "zásadky". Some are for everyone (OIT announcing a new design),
 * some for one student only ("Kontrola osobních údajů" stays until that student
 * confirms their data) — which is why reIS reads them from each student's own
 * page and never from a shared source.
 */
export interface IsNotice {
  /**
   * The same in Czech and English and across both IS designs, so a mute
   * (`is_notice_mutes`) and the read state cover every copy of one notice.
   * `zasadka:<id>` when IS gives the notice an id, else `link:<path>` of its
   * first link, else `title:<title>`.
   */
  key: string;
  title: string;
  /** Plain text of the notice. Never HTML: it is rendered as text. */
  text: string;
  /** The first link in the notice, absolute. Null when it has none. */
  link: string | null;
  /** `crit` is IS's red tile, which the student cannot hide in IS. */
  severity: 'crit' | 'info';
  /** IS's own display window, local time `YYYY-MM-DDTHH:MM`. Null when IS gives none. */
  from: string | null;
  until: string | null;
}

export type IsNoticesByLang = { cz: IsNotice[]; en: IsNotice[] };

/** A notice a reIS admin turned off for everyone (`is_notice_mutes`). */
export interface IsNoticeMute {
  key: string;
  title: string;
}
