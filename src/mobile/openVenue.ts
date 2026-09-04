import { getPlatform } from '../platform';
import { openExternal } from './openExternal';
import { venueMapUrl, venueMapChoices } from '../utils/venueMapUrl';
import { useAppStore } from '../store/useAppStore';

/**
 * Send a student to a venue in a real map app.
 *
 * Deliberately NOT `openExternal`. That validates http(s) only — which is the
 * right guard, since it is also the path a society's own `url` field takes, and
 * without it a crafted app scheme would reach the system handler. A `maps:` or
 * `geo:` URL therefore cannot go through it, and an https one must not: on
 * Capacitor `openExternal` hands third-party links to the in-app browser, which
 * renders a map WEB PAGE instead of opening the Maps app.
 *
 * The scheme is delivered by navigating. Capacitor's iOS delegate cancels any
 * top-level navigation that is not the app's own URL and calls
 * `UIApplication.shared.open`; Android's `BridgeWebViewClient` fires an Intent
 * for the same case. So assigning `location.href` IS the handoff — there is no
 * plugin for it in the installed set (`@capacitor/app` has no `openUrl` here).
 *
 * Off Capacitor nothing has changed: the web URL goes through `openExternal`
 * exactly as before.
 */
export async function openVenue(coord: [number, number], label: string): Promise<void> {
  if (getPlatform().kind !== 'capacitor') {
    await openExternal(venueMapUrl(coord, label, 'web'));
    return;
  }
  const { Capacitor } = await import('@capacitor/core');
  const platform = Capacitor.getPlatform() === 'android' ? 'android' : 'ios';
  const choices = venueMapChoices(coord, label, platform);
  // One option means the SYSTEM is the chooser — Android's `geo:` already asks
  // which map app to use, and putting our own sheet in front of it would be a
  // menu that opens a menu. Only iOS, which never asks, gets one from us.
  if (choices.length === 1) {
    window.location.href = choices[0]!.url;
    return;
  }
  useAppStore.getState().pushSheet({ kind: 'venue', coord, label, platform });
}
