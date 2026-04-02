import type { HiddenItemsSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createHiddenItemsSlice: AppSlice<HiddenItemsSlice> = (set, get) => ({
  hiddenItems: {
    courses: [],
    events: [],
  },

  loadHiddenItems: async () => {
    try {
      const data = await IndexedDBService.get('hidden_items', 'current');
      if (data) {
        set({ hiddenItems: data });
      }
    } catch (error) {
      console.error('Failed to load hidden items:', error);
    }
  },

  hideCourse: async (courseCode: string, courseName: string, type: 'lecture' | 'seminar' | 'all' = 'all') => {
    const { hiddenItems } = get();
    // Don't add if already exactly hidden or if 'all' is already hidden
    if (hiddenItems.courses.some((c) => c.courseCode === courseCode && (c.type === type || c.type === 'all'))) return;

    const newHiddenItems = {
      ...hiddenItems,
      courses: [...hiddenItems.courses, { courseCode, courseName, type }],
    };

    set({ hiddenItems: newHiddenItems });
    await IndexedDBService.set('hidden_items', 'current', newHiddenItems);
  },

  unhideCourse: async (courseCode: string, type?: 'lecture' | 'seminar' | 'all') => {
    const { hiddenItems } = get();
    const newHiddenItems = {
      ...hiddenItems,
      courses: hiddenItems.courses.filter((c) => 
        !(c.courseCode === courseCode && (type === undefined || c.type === type))
      ),
    };

    set({ hiddenItems: newHiddenItems });
    await IndexedDBService.set('hidden_items', 'current', newHiddenItems);
  },

  hideEvent: async (id: string, courseCode: string, courseName: string, date: string) => {
    const { hiddenItems } = get();
    if (hiddenItems.events.some((e) => e.id === id)) return;

    const newHiddenItems = {
      ...hiddenItems,
      events: [...hiddenItems.events, { id, courseCode, courseName, date }],
    };

    set({ hiddenItems: newHiddenItems });
    await IndexedDBService.set('hidden_items', 'current', newHiddenItems);
  },

  unhideEvent: async (id: string) => {
    const { hiddenItems } = get();
    const newHiddenItems = {
      ...hiddenItems,
      events: hiddenItems.events.filter((e) => e.id !== id),
    };

    set({ hiddenItems: newHiddenItems });
    await IndexedDBService.set('hidden_items', 'current', newHiddenItems);
  },
});
