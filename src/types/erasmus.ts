export interface ErasmusReport {
  reportId: string;
  student: { name: string; email: string; faculty: string; coordinator: string };
  host: {
    name: string;
    country: string;
    coordinators: string;
    address: string;
    email: string;
    phone: string;
  };
  stay: { from: string; to: string; durationMonths: number };
  preparation: {
    transport: string;
    transportCost: string;
    insurance: string;
    insuranceCost: string;
    insuranceEvent: string;
    czechHealthInsuranceAccepted: string;
    otherRequirements: string;
    reasons: string;
    infoSource: string;
    languagePrep: string;
    languagePrepDuration: string;
    languagePrepProvider: string;
    languagePrepLevel: string;
  };
  admission: { studyDocs: string; adminDocs: string; fees: string };
  accommodation: {
    automatic: string;
    dormAvailable: string;
    dormDetails: string;
    otherType: string;
    equipment: string;
    notes: string;
    canteenAvailable: string;
    otherFood: string;
    foodNotes: string;
    localTransport: string;
    transportTicket: string;
  };
  study: {
    language: string;
    system: string;
    integratedWithLocals: string;
    workedIndependently: string;
    usesECTS: string;
    specialProgram: string;
    organizationNotes: string;
    examsCount: string;
    creditsCount: string;
    otherOutputs: string;
    teachingLevel: string;
    languageReadiness: string;
    hardestPart: string;
  };
  recognition: { recognized: string; conditions: string; problems: string };
  finance: {
    accommodationPerDay: string;
    foodPerDay: string;
    transportCost: string;
    otherCosts: string;
    otherCostsDescription: string;
    totalCostCZK: string;
    grantCoveragePercent: string;
    unaffordable: string;
    savings: string;
    grantPayments: string;
    grantMethod: string;
    otherFunding: string;
  };
  leisure: {
    activities: string;
    organizedProgram: string;
    programForm: string;
    organizations: string;
    integrationScore: string;
    studentServices: string;
    sports: string;
    sportsDetails: string;
    libraryAccess: string;
    internetAccess: string;
    internetDetails: string;
    workOpportunities: string;
  };
  tips: {
    problemsDuring: string;
    problemsPrep: string;
    positivesPrep: string;
    positivesDuring: string;
  };
  cooperation: { willing: string; howHelp: string };
  overall: { rating: string; review: string; suggestions: string };
}

export interface ErasmusCountryData {
  meta: {
    country: string;
    countryId: string;
    type: string;
    reportCount: number;
    scrapedAt: string;
  };
  reports: ErasmusReport[];
}

export interface ErasmusConfig {
  academicYear: string;
  deadlines: { applicationOpen: string; applicationClose: string; resultsAnnounced: string };
  grants: { eur: number; countries: string[] }[];
  faculties: Record<string, { coordinator: string; email: string }>;
}
