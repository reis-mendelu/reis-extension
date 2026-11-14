import type { VenueRow } from '../../api/venues';

/**
 * The espresso bar in design lab MENDELU (budova F10), as seeded by
 * supabase/migrations/20261109160000_design_lab_venue.sql. Hours, building and
 * the bar's Instagram are from ldf.mendelu.cz/design-lab-mendelu, checked
 * 2026-11-09; the coordinate is the centre of the map's own outline of the
 * building (landmarks.json, id -201).
 *
 * No menu, lunch or photos: the bar publishes its drinks and prices nowhere
 * reIS can read, and a price nobody checked is not put on a card. They are
 * added in Supabase once the bar's own menu is in hand.
 */
export const DESIGN_LAB_VENUE_ROW: VenueRow = {
  id: 'designlab',
  association_id: 'designlab',
  title: 'Espresso bar design lab',
  kind: { cz: 'Espresso bar', en: 'Espresso bar' },
  place: { cz: 'Budova F10', en: 'Building F10' },
  address: {
    cz: 'Přízemí design labu MENDELU · terasa',
    en: 'design lab MENDELU ground floor · terrace',
  },
  room_code: null,
  coord_lng: 16.616806,
  coord_lat: 49.211755,
  hours: [
    { day: 1, open: '07:30', close: '18:00' },
    { day: 2, open: '07:30', close: '18:00' },
    { day: 3, open: '07:30', close: '18:00' },
    { day: 4, open: '07:30', close: '18:00' },
    { day: 5, open: '07:30', close: '15:00' },
  ],
  closed_from: null,
  closed_until: null,
  lunch: null,
  lunch_week: null,
  menu: [],
  photos: [],
  url: 'https://ldf.mendelu.cz/design-lab-mendelu/',
  instagram: 'cerny_kun_v_cernych_polich',
  prices_checked: null,
  sort_order: 10,
};
