  export interface SearchResult {
    id: string;
    title: string;
    type: 'person' | 'subject';
    detail?: string;
    link?: string;
    personType?: 'student' | 'teacher' | 'staff' | 'unknown';
    subjectCode?: string;
    subjectId?: string;
    faculty?: string;
    semester?: string;
    isEnglishVariant?: boolean;
  }

  export interface SearchSection {
    key: string;
    label: string;
    results: SearchResult[];
  }
