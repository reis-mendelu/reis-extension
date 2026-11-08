import type { SocietyPin, VenueMenuItem } from '../../types/campusMap';

// Permanent places a society runs, bundled with the app (a `map_pins` row is
// a place for a while; these do not expire). Their card adds hours and a menu
// to the society pin card. Prices are copied from the venue's own site and
// go stale: `source.checked` is shown on the card, so a student can tell.

const items = (...rows: [string, number | string][]): VenueMenuItem[] =>
  rows.map(([name, price]) => ({ name, price }));

const weekdays = ([1, 2, 3, 4, 5] as const).map((day) => ({ day, open: '08:00', close: '18:00' }));

export const VENUE_PINS: SocietyPin[] = [
  {
    id: 'venue:sklub',
    societyId: 'sklub',
    title: 'S-klub Pixie',
    description: null,
    url: 'https://sklubpixie.cz/',
    // Building Z (FRRMS), tř. Generála Píky 7: the café is on its ground floor.
    coord: [16.614393, 49.218171],
    venue: {
      kind: { cz: 'Kavárna', en: 'Café' },
      where: { cz: 'Budova Z (FRRMS), přízemí', en: 'Building Z (FRRMS), ground floor' },
      hours: weekdays,
      lunch: { name: { cz: 'Denní menu s polévkou', en: 'Daily menu with soup' }, price: 189 },
      instagram: 'sklub_pixie',
      source: { url: 'https://sklubpixie.cz/', checked: '2026-11-08' },
      menu: [
        {
          id: 'coffee',
          title: { cz: 'Káva', en: 'Coffee' },
          items: items(
            ['Espresso', 35],
            ['Espresso Lungo', 35],
            ['Lungo s mlékem', 35],
            ['Cappuccino', 55],
            ['Caffè Latte', 55],
            ['Flat White', 65],
            ['Cold Brew', 65],
            ['Čaj', 45],
            ['Horká čokoláda', 65]
          ),
        },
        {
          id: 'matcha',
          title: { cz: 'Matcha', en: 'Matcha' },
          items: items(
            ['Matcha Latte', 89],
            ['Coconut Matcha', 119],
            ['Mango Matcha', 119],
            ['Strawberry Matcha', 119],
            ['Matcha Red Bull', 139]
          ),
        },
        {
          id: 'bubble',
          title: { cz: 'Bubble tea', en: 'Bubble tea' },
          items: items(
            ['Malina + citron', 119],
            ['Jablko + kiwi', 119],
            ['Liči + citron', 119],
            ['Broskev + med', 119],
            ['Dračí ovoce + liči', 119]
          ),
        },
        {
          id: 'lemonade',
          title: { cz: 'Limonády', en: 'Lemonades' },
          items: items(['Mango Fever', 89], ['Pink Garden', 89], ['Strawberry Breeze', 89]),
        },
        {
          id: 'soft',
          title: { cz: 'Nealko', en: 'Soft drinks' },
          items: items(
            ['Coca-Cola', 30],
            ['Coca-Cola Zero', 30],
            ['Fanta', 30],
            ['Sprite', 30],
            ['Tonic', 30],
            ['Voda neperlivá', 30],
            ['Voda perlivá', 30],
            ['Red Bull', 49],
            ['Nealkoholické pivo', 89]
          ),
        },
        {
          id: 'beer',
          title: { cz: 'Pivo', en: 'Beer' },
          items: items(
            ['Pivo 11°', '45/55'],
            ['Pivo Tchýně', '45/55'],
            ['Pivo Tchýně nealko pomelo', 55],
            ['Plzeň 0,3 plech', 55]
          ),
        },
        {
          id: 'cocktails',
          title: { cz: 'Koktejly', en: 'Cocktails' },
          items: items(
            ['Aperol Spritz', 99],
            ['Campari Soda', 99],
            ['Gin & Tonic', 99],
            ['Hugo Spritz', 99],
            ['Limoncello Spritz', 99],
            ['Mojito', 99],
            ['Prosecco soda jahoda', 99],
            ['Cuba Libre', 109],
            ['Paloma', 119],
            ['Peach Spritz', 119],
            ['Skinny Bitch', 119],
            ['Skinny Bitch Grep', 129],
            ['Skinny Bitch Mango', 129],
            ['Jägerbomb', 139],
            ['Křídla', 139],
            ['Sex on the Beach', 139]
          ),
        },
        {
          id: 'shots',
          title: { cz: 'Panáky', en: 'Shots' },
          items: items(
            ['Zelená', 45],
            ['Modrá', 45],
            ['Broskvová vodka', 60],
            ['Jelzin dle nabídky', 60],
            ['Ořechovice', 60],
            ['Vaječňák', 60],
            ['Absolut Vodka', 80],
            ['Bacardí', 80],
            ['Gin', 80],
            ["Grant's", 80],
            ['Havana Club', 80],
            ['Hruškovice', 80],
            ['Jameson', 80],
            ['Jägermeister', 80],
            ['Republica', 80],
            ['Slivovice', 80],
            ['Tequila', 80],
            ['Legendario', 120],
            ['Metaxa', 120]
          ),
        },
        {
          id: 'prosecco',
          title: { cz: 'Prosecco', en: 'Prosecco' },
          items: items(['Prosecco 0,2 l', 60]),
        },
      ],
    },
  },
];
