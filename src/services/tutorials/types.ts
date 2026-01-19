/**
 * Tutorial types for the reIS tutorials feature.
 * Tutorials are multi-slide guides created by Spolky/admins for students.
 */

/** Layout options for a tutorial slide */
export type SlideLayout = 
  | 'single'              // Full-width single column
  | 'two-column'          // Equal 50/50 split
  | 'two-column-wide-left'  // 60/40 left-heavy
  | 'two-column-wide-right'; // 40/60 right-heavy

/** A single slide within a tutorial */
export interface TutorialSlide {
  id: string;
  tutorialId: string;
  order: number;
  layout: SlideLayout;
  
  // Left/main column content
  leftIcon?: string;      // Lucide icon name (e.g., 'hand', 'ticket')
  leftTitle?: string;
  leftContent?: string;   // Markdown content
  leftImageUrl?: string;
  
  // Right column content (for two-column layouts)
  rightIcon?: string;
  rightTitle?: string;
  rightContent?: string;
  rightImageUrl?: string;
}

/** A complete tutorial with all slides */
export interface Tutorial {
  id: string;
  associationId: string;  // e.g., 'supef', 'esn', 'admin'
  title: string;
  description?: string;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  slides: TutorialSlide[];
}

/** Minimal tutorial info for listing */
export interface TutorialSummary {
  id: string;
  associationId: string;
  title: string;
  description?: string;
  slideCount: number;
}
