export interface Classmate {
  personId: number;
  photoUrl: string;
  name: string;
  studyInfo: string;
  messageUrl?: string;
}

/** Flat list of seminar (Cvičení) classmates for a course */
export type ClassmatesData = Classmate[];
