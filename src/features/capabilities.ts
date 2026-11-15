/**
 * Every user-facing capability, and whether each UI tree has it.
 *
 * reIS has two UI trees (CLAUDE.md > Products and UI trees): the desktop tree
 * the extension renders and the phone tree the iOS/Android apps render, iPad
 * included. A capability on one tree only is the repo's default failure, so
 * each one states both slots: `'present'`, or `{ omitted }` with the written
 * reason. "We have not decided" is written as `undecided: …`, never invented.
 *
 * `surfaces.ts` ties this table to what the trees switch on (the phone's sheet
 * kinds and tabs, the desktop's views), so a new surface fails `tsc` until it
 * names a capability here that its own tree has.
 *
 * Types only, and nothing in the app imports it: an app import would put this
 * file in a tree's import closure, which tree-parity.mjs and
 * contentScriptGraph.test.ts compute.
 */
export type Slot = 'present' | { readonly omitted: string };

export interface Placement {
  readonly desktop: Slot;
  readonly mobile: Slot;
}

export const CAPABILITIES = {
  calendar: { desktop: 'present', mobile: 'present' },
  exams: { desktop: 'present', mobile: 'present' },
  subjects: { desktop: 'present', mobile: 'present' },
  /** Desktop: SubjectFileDrawer. Phone: the subjectDrawer sheet. */
  subjectDetail: { desktop: 'present', mobile: 'present' },
  studyPlan: { desktop: 'present', mobile: 'present' },
  campusMap: { desktop: 'present', mobile: 'present' },
  /** Desktop: the sidebar's ProfilePopup. Phone: the Profil tab. */
  profile: { desktop: 'present', mobile: 'present' },
  /** Language, theme, calendar view. Desktop: ProfilePopup. Phone: a sheet. */
  settings: { desktop: 'present', mobile: 'present' },
  /** The original IS pages. Desktop: the oldIs view. Phone: Starý IS in search. */
  isPages: { desktop: 'present', mobile: 'present' },
  search: { desktop: 'present', mobile: 'present' },
  notifications: { desktop: 'present', mobile: 'present' },
  bulletin: { desktop: 'present', mobile: 'present' },
  menu: { desktop: 'present', mobile: 'present' },
  /** Desktop: ClassmatePersonDrawer and PersonHoverCard. */
  person: { desktop: 'present', mobile: 'present' },
  personPhoto: {
    desktop: {
      omitted:
        "undecided: a classmate's photo enlarges on the phone; the extension shows it at card size only. desktopHasNoOwnPhotoEnlarge decides the student's OWN photo, not a classmate's.",
    },
    mobile: 'present',
  },
  eduroam: { desktop: 'present', mobile: 'present' },
  /** Desktop: DocumentsDrawer. Phone: the docs sheet. */
  studyDocuments: { desktop: 'present', mobile: 'present' },
  /** Desktop: InternshipsMenu in the header. */
  internships: { desktop: 'present', mobile: 'present' },
  /** Desktop: CalendarEventCardHideMenu. */
  hideLesson: { desktop: 'present', mobile: 'present' },
  /** reIS admins only. Desktop: ImpersonationDrawer. */
  impersonation: { desktop: 'present', mobile: 'present' },
  isic: {
    desktop: {
      omitted:
        'The extension cannot run it: the store does nothing off Capacitor and the extension has no host permission for WebISKAM. Decided 2026-10-13 (src/test/guards/desktopHasNoIskam.test.ts).',
    },
    mobile: 'present',
  },
  erasmus: {
    desktop: 'present',
    mobile: {
      omitted:
        'Its Learning Agreement tables and Europe map do not survive a phone, and a shortcut for every student to something only exchange students use is noise (the MobileSheet union, src/store/types.ts).',
    },
  },
  /** Which map app opens a venue. */
  venueAppChooser: {
    desktop: {
      omitted:
        'There is no map app to choose: the desktop opens the venue as a web map link. The chooser exists only because iOS opens Apple Maps without asking (components/mobile/sheets/VenueSheet.tsx).',
    },
    mobile: 'present',
  },
  /** A control, not a surface: no sheet or view names it. */
  showOnMap: {
    desktop: {
      omitted:
        'On a calendar block minutes tall, next to a room name that already says where, the room itself is the control (src/test/guards/desktopHasNoShowOnMap.test.ts).',
    },
    mobile: 'present',
  },
} as const satisfies Record<string, Placement>;

export type CapabilityId = keyof typeof CAPABILITIES;

type PresentOn<Tree extends keyof Placement> = {
  [Id in CapabilityId]: (typeof CAPABILITIES)[Id][Tree] extends 'present' ? Id : never;
}[CapabilityId];

/** A capability the desktop tree has: the only kind a desktop view can be. */
export type DesktopCapabilityId = PresentOn<'desktop'>;
/** A capability the phone tree has: the only kind a sheet or tab can be. */
export type MobileCapabilityId = PresentOn<'mobile'>;
