import type { VenueRow } from '../../api/venues';

/**
 * S-klub Pixie's `venues` row, as seeded by
 * supabase/migrations/20261109120000_venues.sql. Menu, prices, hours and the
 * lunch offer are from sklubpixie.cz, checked 2026-11-08. Tests and verify:ui
 * seeds read it; the app reads the table.
 */
export const SKLUB_VENUE_ROW: VenueRow = {
  id: 'sklub',
  association_id: 'sklub',
  title: 'S-klub Pixie',
  kind: {
    cz: 'Kavárna',
    en: 'Café',
  },
  place: {
    cz: 'Budova Z',
    en: 'Building Z',
  },
  address: {
    cz: 'Přízemí FRRMS · tř. Generála Píky 7',
    en: 'FRRMS ground floor · tř. Generála Píky 7',
  },
  room_code: 'BZ00N1015',
  coord_lng: 16.614393,
  coord_lat: 49.218171,
  hours: [
    {
      day: 1,
      open: '08:00',
      close: '18:00',
    },
    {
      day: 2,
      open: '08:00',
      close: '18:00',
    },
    {
      day: 3,
      open: '08:00',
      close: '18:00',
    },
    {
      day: 4,
      open: '08:00',
      close: '18:00',
    },
    {
      day: 5,
      open: '08:00',
      close: '18:00',
    },
  ],
  closed_from: null,
  closed_until: null,
  lunch: {
    name: {
      cz: 'Denní menu s polévkou',
      en: 'Daily menu with soup',
    },
    note: {
      cz: 've vitríně bagety, croissanty, saláty, sladké',
      en: 'in the display case: baguettes, croissants, salads, sweets',
    },
    price: 189,
  },
  lunch_week: null,
  menu: [
    {
      id: 'coffee',
      title: {
        cz: 'Káva',
        en: 'Coffee',
      },
      photo: 'sklub/kava.jpg',
      items: [
        {
          name: 'Espresso',
          price: 35,
        },
        {
          name: 'Espresso Lungo',
          price: 35,
        },
        {
          name: 'Lungo s mlékem',
          price: 35,
        },
        {
          name: 'Cappuccino',
          price: 55,
        },
        {
          name: 'Caffè Latte',
          price: 55,
        },
        {
          name: 'Flat White',
          price: 65,
        },
        {
          name: 'Cold Brew',
          price: 65,
        },
        {
          name: 'Čaj',
          price: 45,
        },
        {
          name: 'Horká čokoláda',
          price: 65,
        },
      ],
    },
    {
      id: 'matcha',
      title: {
        cz: 'Matcha',
        en: 'Matcha',
      },
      photo: null,
      items: [
        {
          name: 'Matcha Latte',
          price: 89,
        },
        {
          name: 'Coconut Matcha',
          price: 119,
        },
        {
          name: 'Mango Matcha',
          price: 119,
        },
        {
          name: 'Strawberry Matcha',
          price: 119,
        },
        {
          name: 'Matcha Red Bull',
          price: 139,
        },
      ],
    },
    {
      id: 'bubble',
      title: {
        cz: 'Bubble tea',
        en: 'Bubble tea',
      },
      photo: 'sklub/bubble-tea.jpg',
      items: [
        {
          name: 'Malina + citron',
          price: 119,
        },
        {
          name: 'Jablko + kiwi',
          price: 119,
        },
        {
          name: 'Liči + citron',
          price: 119,
        },
        {
          name: 'Broskev + med',
          price: 119,
        },
        {
          name: 'Dračí ovoce + liči',
          price: 119,
        },
      ],
    },
    {
      id: 'lemonade',
      title: {
        cz: 'Limonády',
        en: 'Lemonades',
      },
      photo: null,
      items: [
        {
          name: 'Mango Fever',
          price: 89,
        },
        {
          name: 'Pink Garden',
          price: 89,
        },
        {
          name: 'Strawberry Breeze',
          price: 89,
        },
      ],
    },
    {
      id: 'soft',
      title: {
        cz: 'Nealko',
        en: 'Soft drinks',
      },
      photo: null,
      items: [
        {
          name: 'Coca-Cola',
          price: 30,
        },
        {
          name: 'Coca-Cola Zero',
          price: 30,
        },
        {
          name: 'Fanta',
          price: 30,
        },
        {
          name: 'Sprite',
          price: 30,
        },
        {
          name: 'Tonic',
          price: 30,
        },
        {
          name: 'Voda neperlivá',
          price: 30,
        },
        {
          name: 'Voda perlivá',
          price: 30,
        },
        {
          name: 'Red Bull',
          price: 49,
        },
        {
          name: 'Nealkoholické pivo',
          price: 89,
        },
      ],
    },
    {
      id: 'beer',
      title: {
        cz: 'Pivo',
        en: 'Beer',
      },
      photo: null,
      items: [
        {
          name: 'Pivo 11°',
          price: '45/55',
        },
        {
          name: 'Pivo Tchýně',
          price: '45/55',
        },
        {
          name: 'Pivo Tchýně nealko pomelo',
          price: 55,
        },
        {
          name: 'Plzeň 0,3 plech',
          price: 55,
        },
      ],
    },
    {
      id: 'cocktails',
      title: {
        cz: 'Koktejly',
        en: 'Cocktails',
      },
      photo: null,
      items: [
        {
          name: 'Aperol Spritz',
          price: 99,
        },
        {
          name: 'Campari Soda',
          price: 99,
        },
        {
          name: 'Gin & Tonic',
          price: 99,
        },
        {
          name: 'Hugo Spritz',
          price: 99,
        },
        {
          name: 'Limoncello Spritz',
          price: 99,
        },
        {
          name: 'Mojito',
          price: 99,
        },
        {
          name: 'Prosecco soda jahoda',
          price: 99,
        },
        {
          name: 'Cuba Libre',
          price: 109,
        },
        {
          name: 'Paloma',
          price: 119,
        },
        {
          name: 'Peach Spritz',
          price: 119,
        },
        {
          name: 'Skinny Bitch',
          price: 119,
        },
        {
          name: 'Skinny Bitch Grep',
          price: 129,
        },
        {
          name: 'Skinny Bitch Mango',
          price: 129,
        },
        {
          name: 'Jägerbomb',
          price: 139,
        },
        {
          name: 'Křídla',
          price: 139,
        },
        {
          name: 'Sex on the Beach',
          price: 139,
        },
      ],
    },
    {
      id: 'shots',
      title: {
        cz: 'Panáky',
        en: 'Shots',
      },
      photo: null,
      items: [
        {
          name: 'Zelená',
          price: 45,
        },
        {
          name: 'Modrá',
          price: 45,
        },
        {
          name: 'Broskvová vodka',
          price: 60,
        },
        {
          name: 'Jelzin dle nabídky',
          price: 60,
        },
        {
          name: 'Ořechovice',
          price: 60,
        },
        {
          name: 'Vaječňák',
          price: 60,
        },
        {
          name: 'Absolut Vodka',
          price: 80,
        },
        {
          name: 'Bacardí',
          price: 80,
        },
        {
          name: 'Gin',
          price: 80,
        },
        {
          name: "Grant's",
          price: 80,
        },
        {
          name: 'Havana Club',
          price: 80,
        },
        {
          name: 'Hruškovice',
          price: 80,
        },
        {
          name: 'Jameson',
          price: 80,
        },
        {
          name: 'Jägermeister',
          price: 80,
        },
        {
          name: 'Republica',
          price: 80,
        },
        {
          name: 'Slivovice',
          price: 80,
        },
        {
          name: 'Tequila',
          price: 80,
        },
        {
          name: 'Legendario',
          price: 120,
        },
        {
          name: 'Metaxa',
          price: 120,
        },
      ],
    },
    {
      id: 'prosecco',
      title: {
        cz: 'Prosecco',
        en: 'Prosecco',
      },
      photo: null,
      items: [
        {
          name: 'Prosecco 0,2 l',
          price: 60,
        },
      ],
    },
  ],
  photos: ['sklub/kava.jpg', 'sklub/obed.jpg', 'sklub/bubble-tea.jpg'],
  url: 'https://sklubpixie.cz/',
  instagram: 'sklub_pixie',
  prices_checked: '2026-11-08',
  sort_order: 0,
};
