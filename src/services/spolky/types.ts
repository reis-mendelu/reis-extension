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
  priority: 'normal' | 'high';
  viewCount?: number;
  clickCount?: number;
}
