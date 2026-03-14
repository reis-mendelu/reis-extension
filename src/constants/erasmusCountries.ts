/** ISO 3166-1 numeric → country name mapping for Erasmus+ destinations */
export interface ErasmusCountry {
  id: string;
  cs: string;
  en: string;
  file: string;
}

export const ERASMUS_COUNTRIES: ErasmusCountry[] = [
  { id: '040', cs: 'Rakousko', en: 'Austria', file: 'country-040-study.json' },
  { id: '056', cs: 'Belgie', en: 'Belgium', file: 'country-056-study.json' },
  { id: '100', cs: 'Bulharsko', en: 'Bulgaria', file: 'country-100-study.json' },
  { id: '191', cs: 'Chorvatsko', en: 'Croatia', file: 'country-191-study.json' },
  { id: '196', cs: 'Kypr', en: 'Cyprus', file: 'country-196-study.json' },
  { id: '208', cs: 'Dánsko', en: 'Denmark', file: 'country-208-study.json' },
  { id: '233', cs: 'Estonsko', en: 'Estonia', file: 'country-233-study.json' },
  { id: '246', cs: 'Finsko', en: 'Finland', file: 'country-246-study.json' },
  { id: '250', cs: 'Francie', en: 'France', file: 'country-250-study.json' },
  { id: '276', cs: 'Německo', en: 'Germany', file: 'country-276-study.json' },
  { id: '300', cs: 'Řecko', en: 'Greece', file: 'country-300-study.json' },
  { id: '348', cs: 'Maďarsko', en: 'Hungary', file: 'country-348-study.json' },
  { id: '372', cs: 'Irsko', en: 'Ireland', file: 'country-372-study.json' },
  { id: '380', cs: 'Itálie', en: 'Italy', file: 'country-380-study.json' },
  { id: '428', cs: 'Lotyšsko', en: 'Latvia', file: 'country-428-study.json' },
  { id: '440', cs: 'Litva', en: 'Lithuania', file: 'country-440-study.json' },
  { id: '528', cs: 'Nizozemsko', en: 'Netherlands', file: 'country-528-study.json' },
  { id: '578', cs: 'Norsko', en: 'Norway', file: 'country-578-study.json' },
  { id: '616', cs: 'Polsko', en: 'Poland', file: 'country-616-study.json' },
  { id: '620', cs: 'Portugalsko', en: 'Portugal', file: 'country-620-study.json' },
  { id: '642', cs: 'Rumunsko', en: 'Romania', file: 'country-642-study.json' },
  { id: '688', cs: 'Srbsko', en: 'Serbia', file: 'country-688-study.json' },
  { id: '703', cs: 'Slovensko', en: 'Slovakia', file: 'country-703-study.json' },
  { id: '705', cs: 'Slovinsko', en: 'Slovenia', file: 'slovenia-study.json' },
  { id: '724', cs: 'Španělsko', en: 'Spain', file: 'country-724-study.json' },
  { id: '752', cs: 'Švédsko', en: 'Sweden', file: 'country-752-study.json' },
  { id: '792', cs: 'Turecko', en: 'Turkey', file: 'country-792-study.json' },
  { id: '826', cs: 'Velká Británie', en: 'United Kingdom', file: 'country-826-study.json' },
];

// Only countries with actual reports (excludes CZ, LU, IS, CH, MT, MK, ME with 0 reports)
