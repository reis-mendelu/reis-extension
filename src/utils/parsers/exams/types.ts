export interface ScrapedExamSection {
    id: string;
    name: string;
    nameCs?: string;
    nameEn?: string;
    type: string;
    status: string;
    registeredTerm?: Record<string, unknown>;
    terms: Record<string, unknown>[];
}

export interface ScrapedExamSubject {
    version: 1;
    id: string;
    name: string;
    nameCs?: string;
    nameEn?: string;
    code: string;
    sections: ScrapedExamSection[];
}
