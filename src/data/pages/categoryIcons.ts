import {
  Info,
  GraduationCap,
  Microscope,
  Monitor,
  Calendar,
  FileText,
  Cpu,
  Database,
  BookOpen,
  Gamepad2,
  User,
  ShieldCheck,
  Settings,
} from 'lucide-react';

/** Icon per IS page category, shared by the old-IS view and the search-bar directory popover. */
export const PAGE_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'portal-info': Info,
  'moje-studium': GraduationCap,
  'veda-vyzkum': Microscope,
  elearning: Monitor,
  'osobni-management': Calendar,
  'e-agenda': FileText,
  technologie: Cpu,
  'sprava-is': Database,
  dokumentace: BookOpen,
  herna: Gamepad2,
  personalizace: User,
  'nastaveni-is': Settings,
  'ochrana-udaju': ShieldCheck,
};
