export interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

export interface SearchResult {
  id: string;
  title: string;
  type: 'person' | 'page' | 'subject';
  detail?: string;
  link?: string;
  personType?: 'student' | 'teacher' | 'staff' | 'unknown';
  category?: string;
  subjectCode?: string;
  subjectId?: string;
}
