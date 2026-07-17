import { computeNextSlot } from '@/services/library/nextSlot';
import type { RoomAvailability } from '@/types/library';

type T = (key: string, opts?: Record<string, string | number>) => string;

export function statusLabel(
  room: { leadMinutes: number },
  availability: RoomAvailability | undefined,
  now: Date,
  t: T,
  locale: string
): { text: string; free: boolean; known: boolean } {
  // 'cz' is the app-internal language code (matches IS Mendelu's own 'cz'/'en'
  // convention); it isn't valid Intl locale data — Czech is 'cs'.
  const loc = locale === 'cz' ? 'cs' : locale;
  if (!availability) return { text: '', free: false, known: false };
  const iso = computeNextSlot(availability.blocks, room.leadMinutes, now);
  if (!iso) return { text: t('map.libraryFull'), free: false, known: true };
  const d = new Date(iso);
  const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return { text: t('map.libraryNextSlotToday', { time }), free: true, known: true };
  const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'numeric' });
  return { text: t('map.libraryNextSlotDay', { date, time }), free: true, known: true };
}
