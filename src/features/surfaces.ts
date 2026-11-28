import type { AppView } from '../types/app';
import type { MobileSheet, MobileTab } from '../store/types';
import type { DesktopCapabilityId, MobileCapabilityId } from './capabilities';

/**
 * What each UI tree switches on, tied to the capability it shows.
 *
 * Each map is keyed by the union its tree already switches over, so a new key
 * there fails `tsc` here until it names a capability in `capabilities.ts`, and
 * only one its own tree has: a sheet cannot be a desktop-only capability. A
 * capability present on one tree only must say why in `capabilities.ts`.
 *
 * - `MobileSheet['kind']`: what `mobile/sheets/SheetHost.tsx` switches over.
 * - `MobileTab`: what `mobile/MobileApp.tsx` routes between.
 * - `AppView`: what `AppMain.tsx` renders.
 *
 * Not covered: the desktop's `AppOverlays.tsx` mounts its drawers directly,
 * with no union to key on, so a new desktop drawer does not fail here.
 */

/** A key its union lists but no tree renders, and why. */
export interface Unrendered {
  readonly unrendered: string;
}

export const PHONE_SHEET_CAPABILITY = {
  subjectDrawer: 'subjectDetail',
  studyPlan: 'studyPlan',
  person: 'person',
  personPhoto: 'personPhoto',
  eduroam: 'eduroam',
  docs: 'studyDocuments',
  settings: 'settings',
  impersonation: 'impersonation',
  personas: 'impersonation',
  menu: 'menu',
  isic: 'isic',
  venue: 'venueAppChooser',
  search: 'search',
  notifications: 'notifications',
  bulletin: 'bulletin',
  internships: 'internships',
  hideLesson: 'hideLesson',
  libraryBook: 'libraryBooking',
  libraryCancel: 'libraryBooking',
  libraryBooking: 'libraryBooking',
  confirm: {
    unrendered:
      "Exam register/unregister confirm: ConfirmSheet mounts inside ExamsScreen from useExamActions' pendingAction, so this union member is unused (components/mobile/sheets/ConfirmSheet.tsx).",
  },
} as const satisfies Record<MobileSheet['kind'], MobileCapabilityId | Unrendered>;

export const PHONE_TAB_CAPABILITY = {
  calendar: 'calendar',
  exams: 'exams',
  subjects: 'subjects',
  map: 'campusMap',
  profile: 'profile',
} as const satisfies Record<MobileTab, MobileCapabilityId>;

export const DESKTOP_VIEW_CAPABILITY = {
  calendar: 'calendar',
  exams: 'exams',
  subjects: 'subjects',
  studyPlan: 'studyPlan',
  erasmus: 'erasmus',
  map: 'campusMap',
  oldIs: 'isPages',
  settings: {
    unrendered:
      'undecided: listed in APP_VIEWS, but AppMain renders nothing for it; desktop settings live in the sidebar ProfilePopup.',
  },
  'timeline-demo': {
    unrendered: 'undecided: listed in APP_VIEWS, but no tree renders anything for it.',
  },
} as const satisfies Record<AppView, DesktopCapabilityId | Unrendered>;
