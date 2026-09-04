/**
 * Where "Mystica" should send a student who taps it.
 *
 * It used to be a Google Maps https URL for everyone, opened through
 * `openExternal` — which on Capacitor hands third-party links to the in-app
 * browser (SFSafariViewController / Custom Tabs). That RENDERS a map web page.
 * It does not hand off to the Maps app, so the student got a cramped browser
 * with no "take me there", on the one surface where navigating is the entire
 * point of the tap.
 *
 * A custom scheme is what reaches the app. Capacitor's iOS delegate cancels any
 * top-level navigation that is not the app's own URL and calls
 * `UIApplication.shared.open` (WebViewDelegationHandler); Android's
 * `BridgeWebViewClient` launches an Intent for the same case. So `maps:` and
 * `geo:` both land in a real map app, and neither can go through `openExternal`,
 * which validates http(s) only — deliberately, since that guard is what stops a
 * society's `url` field smuggling an app scheme.
 *
 * `coord` is `[lng, lat]`, as everywhere else in this app; every maps URL wants
 * them the other way round.
 */
export type MapPlatform = 'ios' | 'android' | 'web';

/**
 * `encodeURIComponent` deliberately leaves `(` and `)` alone — they are legal
 * in a query. They are NOT legal inside `geo:`'s label, where a parenthesis
 * closes the delimiter early: "Klub (starý)" ended the label at "Klub (starý"
 * and left a stray bracket in the URI. Encoded here rather than only in the
 * geo branch, so the two platforms cannot disagree about what a venue is
 * called.
 */
function encodeVenue(name: string): string {
  return encodeURIComponent(name).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function venueMapUrl(
  coord: [number, number],
  label: string,
  platform: MapPlatform
): string {
  const [lng, lat] = coord;
  const at = `${lat},${lng}`;
  // A society types its own venue names, so they carry spaces, diacritics and
  // the occasional ampersand — unencoded, "&" truncates the label or injects a
  // parameter. Falling back to the coordinates keeps the pin labelled with
  // something rather than nothing.
  const name = label.trim() || at;

  if (platform === 'ios') {
    // Apple Maps: `ll` places the pin, `q` names it. Present on every iPhone
    // and iPad, so there is nothing to fall back to.
    return `maps://?ll=${at}&q=${encodeVenue(name)}`;
  }
  if (platform === 'android') {
    // `geo:` lets the system offer whichever map apps are installed rather
    // than assuming Google Maps. The label rides in the parentheses the RFC
    // reserves for it, encoded so a bracket in the name cannot close it early.
    return `geo:${at}?q=${at}(${encodeVenue(name)})`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${at}`;
}

export interface VenueMapChoice {
  id: 'apple' | 'google' | 'system';
  /** i18n key for the row's label. */
  labelKey: string;
  url: string;
}

/**
 * The map apps worth offering, per platform.
 *
 * Android needs no list: `geo:` IS the chooser, so the system already asks and
 * a sheet of our own would be a menu that opens a menu.
 *
 * iOS has no chooser at all — `maps:` goes straight to Apple Maps and nothing
 * asks — so the choice has to be offered in the app.
 *
 * Google's entry is an https URL rather than `comgooglemaps://`, deliberately.
 * Querying that scheme needs `LSApplicationQueriesSchemes` in Info.plist, and
 * opening one that is not installed does nothing whatsoever: a dead tap, which
 * is the worst outcome for a row the student deliberately chose. iOS hands the
 * universal link to the Google Maps app when it is installed and to Safari when
 * it is not, so the row always does something.
 */
export function venueMapChoices(
  coord: [number, number],
  label: string,
  platform: MapPlatform
): VenueMapChoice[] {
  if (platform === 'ios') {
    return [
      { id: 'apple', labelKey: 'map.openInAppleMaps', url: venueMapUrl(coord, label, 'ios') },
      { id: 'google', labelKey: 'map.openInGoogleMaps', url: venueMapUrl(coord, label, 'web') },
    ];
  }
  return [
    {
      id: 'system',
      labelKey: 'map.openInMaps',
      url: venueMapUrl(coord, label, platform),
    },
  ];
}
