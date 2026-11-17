import type { SocietyPin, VenueLunchDay } from '../../types/campusMap';
import { SKLUB_PIN_ID } from '../menuTabs';

/**
 * A venue's lunch days. For S-klub, the week the device scraped from
 * sklubpixie.cz (`sklubMenu`) once there is one, so the Jídelníček's tab and
 * the map card agree; otherwise the `lunch_week` the table carries.
 */
export function venueLunchDays(pin: SocietyPin, scraped: VenueLunchDay[]): VenueLunchDay[] {
  if (pin.id === SKLUB_PIN_ID && scraped.length > 0) return scraped;
  return pin.venue?.lunchDays ?? [];
}
