/** Parsed data from IS Mendelu predmety_plan.pl (Learning Agreement page). */

/** A course already added to the Learning Agreement (from table_1). */
export interface LACourse {
  code: string;
  name: string;
  period: string;
  credits: number;
  completion: string;
  language: string;
  result: string;
  changedDate: string;
  changedBy: string;
  recognizedDate: string;
  recognizedBy: string;
}

/** A course available in the study plan dropdown (<select name="predmety_plan">). */
export interface LAEligibleCourse {
  id: string;
  code: string;
  name: string;
  period: string;
  faculty: string;
}

/** A generic recognized course (<select name="predmety_obecne">). */
export interface LAGenericCourse {
  id: string;
  code: string;
  name: string;
  period: string;
  faculty: string;
}

/** Receiving institution details parsed from the form. */
export interface LAInstitution {
  faculty: string;
  address: string;
  dateFrom: string;
  dateTo: string;
  languageLevel: string;
  catalogUrl: string;
}

/** Coordinator contact info. */
export interface LACoordinator {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

/** Full parsed Learning Agreement page. */
export interface LearningAgreementData {
  zadost: string;
  studium: string;
  courses: LACourse[];
  eligibleCourses: LAEligibleCourse[];
  genericCourses: LAGenericCourse[];
  availablePeriods: { id: string; label: string; selected: boolean }[];
  institution: LAInstitution | null;
  sendingCoordinator: LACoordinator | null;
  receivingCoordinator: LACoordinator | null;
  receivingFacultyCoordinator: LACoordinator | null;
  contactPhone: string;
  contactEmail: string;
  subjectAreaCode: string;
  motherLanguage: string;
  canSubmit: boolean;
}
