import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { venueRowToPin } from '../venues';
import { SocietyPinCard } from '../../components/CampusMap/SocietyPinCard';
import { searchVenues } from '../../components/CampusMap/venueSearch';
import { useAppStore } from '../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { menuTabs } from '../../utils/menuTabs';
import { venueStatus } from '../../utils/venues/venueStatus';
import { DESIGN_LAB_VENUE_ROW as ROW } from '../../test/fixtures/designLabVenueRow';
import { SKLUB_VENUE_ROW } from '../../test/fixtures/sklubVenueRow';
import landmarks from '../../data/map/landmarks.json';

vi.mock('../../hooks/ui/useWideViewport', () => ({ useWideViewport: () => false }));

const MIGRATION = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261109160000_design_lab_venue.sql'),
  'utf8'
);
const lab = venueRowToPin(ROW)!;
const sklub = venueRowToPin(SKLUB_VENUE_ROW)!;
const at = (iso: string) => venueStatus(lab.venue!.hours, new Date(iso), lab.venue!.closure);

/**
 * design lab MENDELU's espresso bar is the second venue. It is a row in the
 * `venues` table and nothing else: the pin, the card and the map search already
 * read that table, so this file pins the row's content and the one thing the
 * row must NOT do — reach Jídelníček (Dominik, 9 November 2026: the map only).
 */
describe("design lab's espresso bar as a venue", () => {
  it('reads into a pin at the building the map already draws', () => {
    expect(lab.id).toBe('venue:designlab');
    const outline = JSON.stringify(landmarks).match(
      /"id":-201,"name":"design lab MENDELU".*?"coordinates":\[(\[\[.*?\]\])\]/
    );
    const ring = JSON.parse(outline![1]!) as [number, number][];
    const [lng, lat] = lab.coord;
    expect(lng).toBeGreaterThan(Math.min(...ring.map((p) => p[0])));
    expect(lng).toBeLessThan(Math.max(...ring.map((p) => p[0])));
    expect(lat).toBeGreaterThan(Math.min(...ring.map((p) => p[1])));
    expect(lat).toBeLessThan(Math.max(...ring.map((p) => p[1])));
  });

  // ldf.mendelu.cz/design-lab-mendelu: "Po – ČT 7.30 – 18, Pá 7.30 – 15".
  it('keeps the hours the faculty publishes, Prague time', () => {
    expect(at('2026-11-09T06:29:00Z').open).toBe(false); // Mon 7:29
    expect(at('2026-11-09T06:30:00Z')).toMatchObject({ open: true, closes: '18:00' });
    expect(at('2026-11-12T16:59:00Z').open).toBe(true); // Thu 17:59
    expect(at('2026-11-13T13:59:00Z')).toMatchObject({ open: true, closes: '15:00' });
    expect(at('2026-11-13T14:00:00Z').open).toBe(false); // Fri 15:00
    expect(at('2026-11-14T10:00:00Z')).toMatchObject({ open: false, day: 1, opens: '07:30' });
  });

  it('carries no menu, lunch, photos or price source until the bar confirms them', () => {
    expect(lab.venue).toMatchObject({ menu: [], lunch: null, photos: [], source: null });
    expect(lab.venue!.instagram).toBe('cerny_kun_v_cernych_polich');
    expect(lab.url).toBe('https://ldf.mendelu.cz/design-lab-mendelu/');
  });

  it.each(['design lab', 'designlab', 'espresso', 'Espresso bar'])('is found for "%s"', (q) => {
    expect(searchVenues(q, [sklub, lab])).toEqual([lab]);
  });

  it('is never a Jídelníček tab, whatever the faculty', () => {
    for (const faculty of ['LDF', 'FRRMS', 'PEF', null]) {
      const tabs = menuTabs([], { faculty, venuePins: [lab], dayIso: '2026-11-09' });
      expect(tabs).toEqual([]);
    }
    const frrms = menuTabs([], { faculty: 'FRRMS', venuePins: [lab, sklub], dayIso: '2026-11-09' });
    expect(frrms.map((t) => (t.kind === 'venue' ? t.pin.id : t.key))).toEqual(['venue:sklub']);
  });

  it('is seeded by the migration with the same words and numbers', () => {
    for (const text of [
      ROW.title,
      JSON.stringify(ROW.kind),
      JSON.stringify(ROW.place),
      JSON.stringify(ROW.address),
      JSON.stringify(ROW.hours),
      String(ROW.coord_lng),
      String(ROW.coord_lat),
      ROW.url!,
      ROW.instagram!,
    ]) {
      expect(MIGRATION).toContain(text);
    }
    // Hidden from pickers and the follow list: a place, not a society to follow.
    expect(MIGRATION).toMatch(/'designlab',\s*'design lab MENDELU'[^;]*\bfalse\b/);
  });
});

describe("design lab's card", () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      now: new Date('2026-11-09T12:30:00Z'), // Mon 13:30 in Prague
      venueMenuSection: null,
      sklubMenu: [],
      societies: BUNDLED_SOCIETIES,
      mapEvents: [],
    } as never);
  });
  afterEach(cleanup);

  it('says what and where it is, that it is open, and shows no empty sections', () => {
    render(<SocietyPinCard pin={lab} />);
    expect(screen.getByText('Espresso bar · Budova F10')).toBeTruthy();
    expect(screen.getByText('Espresso bar design lab')).toBeTruthy();
    expect(screen.getByTestId('venue-status').textContent).toBe('Otevřeno');
    expect(screen.getByText(/dnes do 18:00 · Po–Čt 7:30–18:00, Pá 7:30–15:00/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Instagram/ }).getAttribute('href')).toBe(
      'https://www.instagram.com/cerny_kun_v_cernych_polich/'
    );
    expect(screen.queryByText('Menu')).toBeNull();
    expect(screen.queryByTestId('venue-lunch')).toBeNull();
    expect(screen.queryByTestId('venue-photos')).toBeNull();
  });
});
