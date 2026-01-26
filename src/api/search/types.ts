export interface Person {
    id: string | null;
    name: string;
    link: string;
    faculty: string; // The primary faculty or department
    programAndMode: string; // Additional details or roles
    status: string; // e.g., "Student", "Staff", or academic term
    rawDetails: string; // The full, unparsed details
    type: 'student' | 'teacher' | 'staff' | 'unknown';
}

export interface Subject {
    id: string;
    code: string;        // e.g., "EBC-AIS"
    name: string;        // e.g., "Architektury informačních systémů"
    link: string;        // syllabus URL
    faculty: string;     // e.g., "PEF"
    facultyColor: string; // hex color for faculty badge
    semester: string;     // e.g., "ZS 2025/2026"
}
