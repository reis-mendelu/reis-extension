export interface SubjectStatus {
  id: string; // The IS Mendelu ID (e.g., "159410")
  code: string; // "EBC-ALG"
  name: string; // "Algoritmizace"
  credits: number; // 6
  type: string; // "zk", "záp"
  isEnrolled: boolean;
  isFulfilled: boolean;
  fulfillmentDate?: string; // "05.01.2026"
  rawStatusText: string;
}

export interface SubjectGroup {
  name: string; // e.g., "Skupina předmětů povinných"
  statusDescription: string; // e.g., "NESPLNĚNA chybí 6 předmětů" or "SPLNĚNA"
  subjects: SubjectStatus[];
}

export interface SemesterBlock {
  title: string; // e.g., "1. semestr ZS 2025/2026 - PEF"
  groups: SubjectGroup[];
}

export interface DescriptionSection {
  title: string;
  content: string; // HTML content for rich display
}

export interface StudyPlan {
  title: string; // e.g., "B-OI prez - ZS 2025/2026"
  isFulfilled: boolean;
  creditsAcquired: number;
  creditsRequired: number;
  blocks: SemesterBlock[];
  descriptionSections: DescriptionSection[];
}
