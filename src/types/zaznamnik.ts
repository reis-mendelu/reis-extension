export interface PhArch {
    name: string;
    empty: boolean;
    columns: string[];  // table headers (Slučka column excluded)
    values: string[];   // student row cells (Slučka cell excluded)
}

export interface PhSection {
    label: string;
    arches: PhArch[];
}

export interface SubjectPh {
    sections: PhSection[];
    fetchedAt: number;
}

export interface VtTestAttempt {
    name: string;
    score: number;
    maxScore: number;
    successPct: number;
    submittedAt: string;
    teacher: string;
    hasDetail: boolean;
}

export interface SubjectVt {
    tests: VtTestAttempt[];
    fetchedAt: number;
}

export interface SubjectZaznamnik {
    ph: SubjectPh;
    vt: SubjectVt;
}
