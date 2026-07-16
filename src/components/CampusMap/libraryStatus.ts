import { computeNextSlot } from '@/services/library/nextSlot';
import type { RoomAvailability } from '@/types/library';

type T = (key: string, opts?: Record<string, string | number>) => string;

export function statusLabel(
  room: { leadMinutes: number },
  availability: RoomAvailability | undefined,
  now: Date,
  t: T,
  locale: string,
): { text: string; free: boolean } {
  if (!availability) return { text: t('map.libraryFull'), free: false };
  const iso = computeNextSlot(availability.blocks, room.leadMinutes, now);
  if (!iso) return { text: t('map.libraryFull'), free: false };
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return { text: t('map.libraryNextSlotToday', { time }), free: true };
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  return { text: t('map.libraryNextSlotDay', { date, time }), free: true };
}
