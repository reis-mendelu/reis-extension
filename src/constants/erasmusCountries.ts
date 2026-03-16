/** ISO 3166-1 numeric → country name mapping for Erasmus+ destinations */
export interface ErasmusCountry {
  id: string;
  alpha2: string;
  cs: string;
  en: string;
  file: string;
}

export const ERASMUS_COUNTRIES: ErasmusCountry[] = [
  { id: '040', alpha2: 'AT', cs: 'Rakousko', en: 'Austria', file: 'country-040-study.json' },
  { id: '056', alpha2: 'BE', cs: 'Belgie', en: 'Belgium', file: 'country-056-study.json' },
  { id: '100', alpha2: 'BG', cs: 'Bulharsko', en: 'Bulgaria', file: 'country-100-study.json' },
  { id: '191', alpha2: 'HR', cs: 'Chorvatsko', en: 'Croatia', file: 'country-191-study.json' },
  { id: '196', alpha2: 'CY', cs: 'Kypr', en: 'Cyprus', file: 'country-196-study.json' },
  { id: '208', alpha2: 'DK', cs: 'Dánsko', en: 'Denmark', file: 'country-208-study.json' },
  { id: '233', alpha2: 'EE', cs: 'Estonsko', en: 'Estonia', file: 'country-233-study.json' },
  { id: '246', alpha2: 'FI', cs: 'Finsko', en: 'Finland', file: 'country-246-study.json' },
  { id: '250', alpha2: 'FR', cs: 'Francie', en: 'France', file: 'country-250-study.json' },
  { id: '276', alpha2: 'DE', cs: 'Německo', en: 'Germany', file: 'country-276-study.json' },
  { id: '300', alpha2: 'GR', cs: 'Řecko', en: 'Greece', file: 'country-300-study.json' },
  { id: '348', alpha2: 'HU', cs: 'Maďarsko', en: 'Hungary', file: 'country-348-study.json' },
  { id: '372', alpha2: 'IE', cs: 'Irsko', en: 'Ireland', file: 'country-372-study.json' },
  { id: '380', alpha2: 'IT', cs: 'Itálie', en: 'Italy', file: 'country-380-study.json' },
  { id: '428', alpha2: 'LV', cs: 'Lotyšsko', en: 'Latvia', file: 'country-428-study.json' },
  { id: '440', alpha2: 'LT', cs: 'Litva', en: 'Lithuania', file: 'country-440-study.json' },
  { id: '528', alpha2: 'NL', cs: 'Nizozemsko', en: 'Netherlands', file: 'country-528-study.json' },
  { id: '578', alpha2: 'NO', cs: 'Norsko', en: 'Norway', file: 'country-578-study.json' },
  { id: '616', alpha2: 'PL', cs: 'Polsko', en: 'Poland', file: 'country-616-study.json' },
  { id: '620', alpha2: 'PT', cs: 'Portugalsko', en: 'Portugal', file: 'country-620-study.json' },
  { id: '642', alpha2: 'RO', cs: 'Rumunsko', en: 'Romania', file: 'country-642-study.json' },
  { id: '688', alpha2: 'RS', cs: 'Srbsko', en: 'Serbia', file: 'country-688-study.json' },
  { id: '703', alpha2: 'SK', cs: 'Slovensko', en: 'Slovakia', file: 'country-703-study.json' },
  { id: '705', alpha2: 'SI', cs: 'Slovinsko', en: 'Slovenia', file: 'slovenia-study.json' },
  { id: '724', alpha2: 'ES', cs: 'Španělsko', en: 'Spain', file: 'country-724-study.json' },
  { id: '752', alpha2: 'SE', cs: 'Švédsko', en: 'Sweden', file: 'country-752-study.json' },
  { id: '792', alpha2: 'TR', cs: 'Turecko', en: 'Turkey', file: 'country-792-study.json' },
  { id: '826', alpha2: 'GB', cs: 'Velká Británie', en: 'United Kingdom', file: 'country-826-study.json' },
];

// Only countries with actual reports (excludes CZ, LU, IS, CH, MT, MK, ME with 0 reports)
