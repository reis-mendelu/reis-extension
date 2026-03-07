import { fetchWithAuth, BASE_URL } from "./client";
import type { StudyPlan, SemesterBlock, SubjectGroup, SubjectStatus } from "../types/studyPlan";

// The endpoint for finding a student's study plan
const STUDY_PLAN_URL = `${BASE_URL}/auth/studijni/studijni_povinnosti.pl`;

export async function fetchStudyPlan(studium: string): Promise<StudyPlan | null> {
    try {
        const url = `${STUDY_PLAN_URL}?studium=${studium};lang=cz`;
        const response = await fetchWithAuth(url);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        return parseStudyPlanDOM(doc);
    } catch (e) {
        console.error('[Study Plan API] Failed to fetch or parse:', e);
        return null;
    }
}

function parseStudyPlanDOM(doc: Document): StudyPlan {
  const bodyText = doc.body.textContent || '';
  const isFulfilled = !bodyText.includes('Studijní plán není dosud splněn');

  let creditsAcquired = 0;
  let creditsRequired = 0;
  
  const allTds = Array.from(doc.querySelectorAll('td'));
  for (const td of allTds) {
    if (td.textContent && td.textContent.includes('Kredity:')) {
      const parentRow = td.parentElement;
      if (parentRow) {
        const creditText = (parentRow.textContent || '').replace(/\s+/g, ' '); // Normalize spaces
        const match = creditText.match(/(\d+)\s+získaných.*?ze\s+(\d+)\s+povinných/);
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

    if (boldText.match(/\d+\.\s+semestr/i) || boldText === 'Skupiny předmětů pro celý plán' || boldText === 'Volitelné předměty za celé období daného studia') {
      currentBlock = { title: boldText, groups: [] };
      blocks.push(currentBlock);
      currentGroup = null;
      continue;
    }

    if (boldText.startsWith('Skupina předmětů')) {
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
        if ((row.textContent || '').includes('V tomto semestru nejsou doporučené předměty')) {
            continue;
        }

        const visibleCells = cells.filter(cell => !cell.classList.contains('UISTMNumberCellHidden'));
        
        if (visibleCells.length >= 6) {
            const codeCell = visibleCells[0];
            const nameCell = visibleCells[1];
            const typeCell = visibleCells[2];
            const creditsCell = visibleCells[3];
            const enrolledCell = visibleCells[4];
            const statusCell = visibleCells[5];

            const codeHtml = codeCell.innerHTML || '';
            const idMatch = codeHtml.match(/predmet=(\d+)/);
            const id = idMatch ? idMatch[1] : '';

            const nameNode = nameCell.cloneNode(true) as Element;
            const favLinks = nameNode.querySelectorAll('a[href^="javascript:favourite"]');
            for (let j = 0; j < favLinks.length; j++) favLinks[j].remove();
            const cleanName = (nameNode.textContent || '').trim();

            const rawStatus = (statusCell.textContent || '').trim();
            const isFulfilled = rawStatus.includes('SPLNĚNO');
            const isEnrolled = rawStatus.includes('ZAPSÁNO') && !rawStatus.includes('NEZAPSÁNO');

            let fulfillmentDate = undefined;
            if (isFulfilled) {
                const dateMatch = rawStatus.match(/(\d{2}\.\d{2}\.\d{4})/);
                if (dateMatch) fulfillmentDate = dateMatch[1];
            }

            const subject: SubjectStatus = {
                id,
                code: (codeCell.textContent || '').trim(),
                name: cleanName,
                type: (typeCell.textContent || '').trim(),
                credits: parseInt((creditsCell.textContent || '').trim(), 10) || 0,
                isEnrolled,
                isFulfilled,
                rawStatusText: rawStatus,
                fulfillmentDate
            };

            if (!currentGroup && currentBlock) {
                currentGroup = { name: "Ostatní předměty", statusDescription: "", subjects: [] };
                currentBlock.groups.push(currentGroup);
            }

            if (currentGroup) {
                currentGroup.subjects.push(subject);
            }
        }
    }
  }

  return {
    title: "Parsed Study Plan",
    isFulfilled,
    creditsAcquired,
    creditsRequired,
    blocks
  };
}
