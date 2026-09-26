/**
 * Student Association (Spolek) integration types
 */

export interface SpolekNotification {
  id: string;
  associationId?: string; // 'supef' | 'au_frrms' | 'agro' | ...
  title: string;
  body: string;
  link?: string;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  // The event's own start day (YYYY-MM-DD), which decides when it goes live.
  // Absent on academic rows and on caches written before it existed.
  startsAt?: string;
  priority: 'normal' | 'high';
  viewCount?: number;
  clickCount?: number;
}
