import { parseExamData } from "../utils/examParser";
import type { ExamSubject } from "../components/ExamDrawer";

const EXAM_URL = 'https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=149707;obdobi=801;lang=cz';

export async function fetchExamData(): Promise<ExamSubject[]> {
    try {
        const response = await fetch(EXAM_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch exams: ${response.statusText}`);
        }
        const html = await response.text();
        const data = parseExamData(html);
        return data;
    } catch (error) {
        console.error("Error fetching exam data:", error);
        return [];
    }
}
