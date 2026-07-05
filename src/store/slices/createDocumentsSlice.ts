import type { AppSlice, DocumentsSlice } from '../types';

export const createDocumentsSlice: AppSlice<DocumentsSlice> = (set) => ({
  isDocumentsOpen: false,
  setIsDocumentsOpen: (isOpen) => set({ isDocumentsOpen: isOpen }),
});
