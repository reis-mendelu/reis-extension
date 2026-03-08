  export interface SearchResult {
    id: string;
    title: string;
    type: 'person' | 'page' | 'subject' | 'action';
    detail?: string;
    link?: string;
    personType?: 'student' | 'teacher' | 'staff' | 'unknown';
    category?: string;
    subjectCode?: string;
    subjectId?: string;
    faculty?: string;
    semester?: string;
    onExecute?: () => void;
    keywords?: string[];
  }
