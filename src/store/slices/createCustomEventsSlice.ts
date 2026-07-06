import type { CalendarCustomEventsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import type { CalendarCustomEvent } from '../../types/calendarTypes';
import { logError } from '../../utils/reportError';

export const createCustomEventsSlice: AppSlice<CalendarCustomEventsSlice> = (set, get) => ({
  customEvents: [],

  loadCalendarCustomEvents: async () => {
    try {
      const data = await IndexedDBService.getAllWithKeys('custom_events');
      if (Array.isArray(data)) {
        set({ customEvents: data.map((item) => item.value as CalendarCustomEvent) });
      }
    } catch (error) {
      logError('CustomEventsSlice.loadCalendarCustomEvents', error);
    }
  },

  addCalendarCustomEvent: async (event: CalendarCustomEvent) => {
    const { customEvents } = get();
    const newCustomEvents = [...customEvents, event];

    set({ customEvents: newCustomEvents });
    await IndexedDBService.set('custom_events', event.id, event);
  },

  updateCalendarCustomEvent: async (id: string, patch: Partial<CalendarCustomEvent>) => {
    const { customEvents } = get();
    const eventIndex = customEvents.findIndex((e) => e.id === id);
    if (eventIndex === -1) return;

    // safe: eventIndex !== -1 guaranteed above
    const updatedEvent = { ...customEvents[eventIndex]!, ...patch };
    const newCustomEvents = [
      ...customEvents.slice(0, eventIndex),
      updatedEvent,
      ...customEvents.slice(eventIndex + 1),
    ];

    set({ customEvents: newCustomEvents });
    await IndexedDBService.set('custom_events', id, updatedEvent);
  },

  removeCalendarCustomEvent: async (id: string) => {
    const { customEvents } = get();
    const newCustomEvents = customEvents.filter((e) => e.id !== id);

    set({ customEvents: newCustomEvents });
    await IndexedDBService.delete('custom_events', id);
  },
});
