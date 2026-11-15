// Column layout of an odevzdavarny.pl table read from its header text — the
// fallback for a UIS school whose tables are not MENDELU's.
//
// The parser tries MENDELU's fixed layouts first (LAYOUTS in
// odevzdavarnyParser.ts). Only when a header's cell count differs does it come
// here, so MENDELU and ČZU (same headers, verified on its 2026-10 dump) never
// reach this code.
//
// InSIS VŠE (verified on a real page, 2026-11-08) prints MENDELU's columns plus
// "Odkdy"/"Since" before "Dokdy"/"Until":
//   open:      … | Vypsáno pro | Odkdy | Dokdy | Téma | Podrobnosti | …
//   submitted: … | Vypsáno pro | Odkdy | Dokdy | Téma | Otevřená | Body | …
//   closed:    … | Vypsáno pro | Odkdy | Dokdy | Téma | Otevřená | Podrobnosti | …
//
// Strict on purpose: every header must be one of MENDELU's labels for that
// table, each exactly once, and "Odkdy" is the only extra one allowed. A column
// nobody knows still means null, never a row read from the wrong cell.

import type { Layout, OdevzdavarnaSection } from './odevzdavarnyParser';

type Role =
  | 'course' | 'name' | 'type' | 'announcedFor' | 'from' | 'deadline' | 'topic'
  | 'status' | 'points' | 'details' | 'files' | 'instructions' | 'teacher'
  | 'insert' | 'display';

const LABELS: Record<'cz' | 'en', Record<string, Role>> = {
  cz: {
    'Název předmětu': 'course', 'Název': 'name', 'Typ': 'type', 'Vypsáno pro': 'announcedFor',
    'Odkdy': 'from', 'Dokdy': 'deadline', 'Téma': 'topic', 'Otevřená': 'status', 'Body': 'points',
    'Podrobnosti': 'details', 'Počet souborů': 'files', 'Pokyny': 'instructions', 'Vypsal': 'teacher',
    'Vkládat soubory': 'insert', 'Zobrazit soubory': 'display',
  },
  en: {
    'Course title': 'course', 'Name': 'name', 'Type': 'type', 'Announced for': 'announcedFor',
    'Since': 'from', 'Until': 'deadline', 'Topic': 'topic', 'Open': 'status', 'Points': 'points',
    'Details': 'details', 'Number of files': 'files', 'Instructions': 'instructions', 'Put up by': 'teacher',
    'Insert files': 'insert', 'Display files': 'display',
  },
};

const COMMON: Role[] = ['course', 'name', 'type', 'announcedFor', 'deadline', 'topic', 'details', 'files', 'instructions', 'teacher'];

/** MENDELU's columns per table; 'from' (Odkdy) may come on top. */
const REQUIRED: Record<OdevzdavarnaSection, Role[]> = {
  open: [...COMMON, 'insert'],
  submitted: [...COMMON, 'status', 'points', 'display'],
  closed: [...COMMON, 'status', 'display'],
};

/**
 * MENDELU's "EBC-PJ", or a VŠE code before the course name: faculty digit,
 * letters, optional digits ("5EN254", "5OBP", "2AJ324"), or "UP02"-style.
 * Shapes taken from the VŠE study plan (fixtures/studijni-povinnosti.vse.cz.html).
 */
const COURSE_CODE = /^([A-Z]{2,4}-[A-Z0-9]+|\d[A-Z]{2,3}\d{0,3}|[A-Z]{2}\d{2}) /;

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

/** The table's layout from its header labels, or null when it is not one we know. */
export function layoutFromHeaders(
  headers: string[],
  section: OdevzdavarnaSection,
  lang: 'cz' | 'en'
): Layout | null {
  const at = new Map<Role, number>();
  for (let i = 0; i < headers.length; i++) {
    const role = LABELS[lang][clean(headers[i]!)];
    if (!role || at.has(role)) return null;
    at.set(role, i);
  }
  const required = REQUIRED[section];
  if (at.size !== required.length + (at.has('from') ? 1 : 0)) return null;
  if (!required.every((r) => at.has(r))) return null;
  // parseRow reads the course, name and type from the first three cells.
  if (at.get('course') !== 0 || at.get('name') !== 1 || at.get('type') !== 2) return null;

  const link = at.get(section === 'open' ? 'insert' : 'display')!;
  return {
    cells: headers.length,
    deadline: at.get('deadline')!,
    status: at.get('status') ?? null,
    points: at.get('points') ?? null,
    details: at.get('details')!,
    files: at.get('files')!,
    link,
    instructions: at.get('instructions')!,
    courseCode: COURSE_CODE,
  };
}
