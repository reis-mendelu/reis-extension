export interface StudyProgramCourse {
    Semester: string;
    Category: string;
    Code: string;
    Name: string;
    Completion: string;
    Credits: string;
    Link: string;
}

export interface StudyProgramData {
    programs: any[];
    specializations: any[];
    finalTable: StudyProgramCourse[];
    lastUpdated: number;
}
