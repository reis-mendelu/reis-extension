import { fetchWithAuth, BASE_URL } from "./client";
import type { StudyPlan, DualLanguageStudyPlan, SemesterBlock, SubjectGroup, SubjectStatus } from "../types/studyPlan";

const STUDY_PLAN_URL = `${BASE_URL}/auth/studijni/studijni_povinnosti.pl`;

type Lang = 'cz' | 'en';

interface LangConstants {
    planNotFulfilled: string;
    creditsLabel: string;
    creditsRegex: RegExp;
    semesterPattern: RegExp;
    wholeplanGroups: string[];
    groupPrefix: string;
    noSubjectsMessage: string;
    fulfilledStatus: string;
    enrolledStatus: string;
    notEnrolledStatus: string;
    dateRegex: RegExp;
    fallbackGroupName: string;
}

const LANG: Record<Lang, LangConstants> = {
    cz: {
        planNotFulfilled: 'Studijní plán není dosud splněn',
        creditsLabel: 'Kredity:',
        creditsRegex: /(\d+)\s+získaných.*?ze\s+(\d+)\s+povinných/,
        semesterPattern: /\d+\.\s+semestr/i,
        wholeplanGroups: [
            'Skupiny předmětů pro celý plán',
            'Volitelné předměty za celé období daného studia',
        ],
        groupPrefix: 'Skupina předmětů',
        noSubjectsMessage: 'V tomto semestru nejsou doporučené předměty',
        fulfilledStatus: 'SPLNĚNO',
        enrolledStatus: 'ZAPSÁNO',
        notEnrolledStatus: 'NEZAPSÁNO',
        dateRegex: /(\d{2}\.\d{2}\.\d{4})/,
        fallbackGroupName: 'Ostatní předměty',
    },
    en: {
        planNotFulfilled: 'The study plan has not been completed yet',
        creditsLabel: 'Credits:',
        creditsRegex: /(\d+)\s+obtained.*?(?:of|out of)\s+(\d+)\s+of compulsory/,
        semesterPattern: /\d+\w*\s+semester/i,
        wholeplanGroups: [
            'Groups of courses for the entire plan',
            'Optional courses for the whole period of the given study',
        ],
        groupPrefix: 'A group of',
        noSubjectsMessage: 'There are no recommended subjects in this semester',
        fulfilledStatus: 'FULFILLED',
        enrolledStatus: 'ENROLLED',
        notEnrolledStatus: 'NOT ENROLLED',
        dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
        fallbackGroupName: 'Other courses',
    },
};

export async function fetchDualLanguageStudyPlan(studium: string): Promise<DualLanguageStudyPlan | null> {
    try {
        const [czRes, enRes] = await Promise.all([
            fetchWithAuth(`${STUDY_PLAN_URL}?studium=${studium};lang=cz`),
            fetchWithAuth(`${STUDY_PLAN_URL}?studium=${studium};lang=en`),
        ]);

        const [czHtml, enHtml] = await Promise.all([czRes.text(), enRes.text()]);
        const parser = new DOMParser();

        const czPlan = parseStudyPlanDOM(parser.parseFromString(czHtml, 'text/html'), 'cz');
        const enPlan = parseStudyPlanDOM(parser.parseFromString(enHtml, 'text/html'), 'en');

        return { cz: czPlan, en: enPlan };
    } catch (e) {
        console.error('[Study Plan API] Failed to fetch or parse:', e);
        return null;
    }
}

function extractPlanTitle(doc: Document): string {
    const fontEls = doc.querySelectorAll('font[size="+1"]');
    for (const el of fontEls) {
        const text = (el.textContent || '').trim();
        if (/[A-Z]-\w+.*[ZW]S\s+\d{4}/.test(text)) return text;
    }
    const boldEls = doc.querySelectorAll('b');
    for (const el of boldEls) {
        const text = (el.textContent || '').trim();
        if (/[A-Z]-\w+.*[ZW]S\s+\d{4}/.test(text)) return text;
    }
    return 'Study Plan';
}

function parseStudyPlanDOM(doc: Document, lang: Lang): StudyPlan {
    const L = LANG[lang];
    const bodyText = doc.body.textContent || '';
    const isFulfilled = !bodyText.includes(L.planNotFulfilled);

    let creditsAcquired = 0;
    let creditsRequired = 0;

    const allTds = Array.from(doc.querySelectorAll('td'));
    for (const td of allTds) {
        if (td.textContent && td.textContent.includes(L.creditsLabel)) {
            const parentRow = td.parentElement;
            if (parentRow) {
                const creditText = (parentRow.textContent || '').replace(/\s+/g, ' ');
                const match = creditText.match(L.creditsRegex);
                if (match) {
                    creditsAcquired = parseInt(match[1], 10);
                    creditsRequired = parseInt(match[2], 10);
                }
            }
            break;
        }
    }

    const blocks: SemesterBlock[] = [];
    let currentBlock: SemesterBlock | null = null;
    let currentGroup: SubjectGroup | null = null;

    const table = doc.getElementById('tmtab_1') || doc;
    const rows = Array.from(table.querySelectorAll('tr'));

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));

        if (cells.length === 2 && (row.textContent || '').trim() === '') continue;

        const boldEls = row.querySelectorAll('b');
        const boldText = boldEls.length > 0 ? (boldEls[0].textContent || '').trim() : '';

        if (boldText.match(L.semesterPattern) || L.wholeplanGroups.includes(boldText)) {
            currentBlock = { title: boldText, groups: [] };
            blocks.push(currentBlock);
            currentGroup = null;
            continue;
        }

        if (boldText.startsWith(L.groupPrefix)) {
            const rawText = (row.textContent || '').trim();
            let name = boldText;
            let statusDesc = '';

            if (rawText.includes('-')) {
                const parts = rawText.split('-');
                name = parts[0].trim();
                statusDesc = parts.slice(1).join('-').trim();
            } else {
                statusDesc = rawText;
            }

            currentGroup = { name, statusDescription: statusDesc, subjects: [] };
            if (currentBlock) {
                currentBlock.groups.push(currentGroup);
            }
            continue;
        }

        if (row.classList.contains('predmety_vse') || row.classList.contains('uis-hl-table')) {
            if ((row.textContent || '').includes(L.noSubjectsMessage)) continue;

            const visibleCells = cells.filter(cell => !cell.classList.contains('UISTMNumberCellHidden'));

            if (visibleCells.length >= 6) {
                const codeCell = visibleCells[0];
                const nameCell = visibleCells[1];
                const typeCell = visibleCells[2];
                const creditsCell = visibleCells[3];
                const statusCell = visibleCells[5];

                const codeHtml = codeCell.innerHTML || '';
                const idMatch = codeHtml.match(/predmet=(\d+)/);
                const id = idMatch ? idMatch[1] : '';

                const nameNode = nameCell.cloneNode(true) as Element;
                const favLinks = nameNode.querySelectorAll('a[href^="javascript:favourite"]');
                for (let j = 0; j < favLinks.length; j++) favLinks[j].remove();
                const cleanName = (nameNode.textContent || '').trim();

                const rawStatus = (statusCell.textContent || '').trim();
                const subjectFulfilled = rawStatus.includes(L.fulfilledStatus);
                const isEnrolled = rawStatus.includes(L.enrolledStatus) && !rawStatus.includes(L.notEnrolledStatus);

                let fulfillmentDate = undefined;
                if (subjectFulfilled) {
                    const dateMatch = rawStatus.match(L.dateRegex);
                    if (dateMatch) fulfillmentDate = dateMatch[1];
                }

                const subject: SubjectStatus = {
                    id,
                    code: (codeCell.textContent || '').trim(),
                    name: cleanName,
                    type: (typeCell.textContent || '').trim(),
                    credits: parseInt((creditsCell.textContent || '').trim(), 10) || 0,
                    isEnrolled,
                    isFulfilled: subjectFulfilled,
                    rawStatusText: rawStatus,
                    fulfillmentDate
                };

                if (!currentGroup && currentBlock) {
                    currentGroup = { name: L.fallbackGroupName, statusDescription: "", subjects: [] };
                    currentBlock.groups.push(currentGroup);
                }

                if (currentGroup) {
                    currentGroup.subjects.push(subject);
                }
            }
        }
    }

    return {
        title: extractPlanTitle(doc),
        isFulfilled,
        creditsAcquired,
        creditsRequired,
        blocks,
    };
}
