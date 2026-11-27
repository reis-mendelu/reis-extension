import type { ComponentType } from 'react';
import { BookOpen } from 'lucide-react';
import type { StudyAidsEntry } from '../../data/studyAids';
import { DiscordMark } from './DiscordMark';

/** What both trees' rows accept as an icon: lucide's own, or a brand mark. */
export type RowIcon = ComponentType<{ size?: number; className?: string }>;

const ICONS: Record<StudyAidsEntry['icon'], RowIcon> = {
  book: BookOpen,
  discord: DiscordMark,
};

/** The mark a link under Předměty is shown with, on either tree. */
export function studyAidsIcon(kind: StudyAidsEntry['icon']): RowIcon {
  return ICONS[kind];
}
