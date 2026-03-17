export interface Odevzdavarna {
    courseId: string;
    courseNameCs: string;
    courseNameEn: string;
    name: string;
    type: string;
    deadline: string;
    odevzdavarnaId: string;
    fileCount: number;
    uploadUrl: string;
}

interface RawOdevzdavarna {
    courseId: string;
    courseName: string;
    name: string;
    type: string;
    deadline: string;
    odevzdavarnaId: string;
    fileCount: number;
    uploadUrl: string;
}

function findOpenTable(doc: Document, lang: 'cz' | 'en'): HTMLTableElement | null {
    const marker = lang === 'cz' ? 'Kam mohu odevzd' : 'Where I can submit';
    const bolds = doc.getElementsByTagName('b');
    for (let i = 0; i < bolds.length; i++) {
        if (bolds[i].textContent?.trim().startsWith(marker)) {
            let sibling = bolds[i].nextElementSibling;
            while (sibling) {
                if (sibling.tagName === 'TABLE') return sibling as HTMLTableElement;
                sibling = sibling.nextElementSibling;
            }
            // Also check parent's siblings
            let parent = bolds[i].parentElement;
            while (parent) {
                sibling = parent.nextElementSibling;
                while (sibling) {
                    if (sibling.tagName === 'TABLE') return sibling as HTMLTableElement;
                    const table = sibling.querySelector('table');
                    if (table) return table;
                    sibling = sibling.nextElementSibling;
                }
                parent = parent.parentElement;
            }
        }
    }
    return null;
}

async function fetchLang(studium: string, obdobi: string, lang: 'cz' | 'en'): Promise<RawOdevzdavarna[] | null> {
    try {
        const url = `https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=${studium};obdobi=${obdobi};lang=${lang}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch odevzdavarny");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const table = findOpenTable(doc, lang);
        if (!table) return [];

        const rows = table.getElementsByTagName('tr');
        const assignments: RawOdevzdavarna[] = [];

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].getElementsByTagName('td');
            if (cols.length < 8) continue;

            const courseLink = cols[0].getElementsByTagName('a')[0];
            const rawCourseName = courseLink?.textContent?.trim() || cols[0].textContent?.trim() || "";
            // Strip course code prefix like "EBC-DSND " to get just the name
            const courseName = rawCourseName.replace(/^[A-Z]{2,4}-[A-Z0-9]+ /, '');
            const syllabusHref = courseLink?.getAttribute('href') || "";
            const predmetMatch = syllabusHref.match(/predmet=(\d+)/);
            const courseId = predmetMatch ? predmetMatch[1] : "";

            const name = cols[1].textContent?.trim() || "";

            const typeImg = cols[2].getElementsByTagName('img')[0];
            const type = typeImg?.getAttribute('sysid') || "";

            const deadline = cols[4].textContent?.trim() || "";

            const fileCountText = cols[7].textContent?.trim() || "0";
            const fileCount = parseInt(fileCountText, 10) || 0;

            const uploadLink = cols[10]?.getElementsByTagName('a')[0];
            let uploadUrl = uploadLink?.getAttribute('href') || "";
            if (uploadUrl && !uploadUrl.startsWith('http')) {
                uploadUrl = `https://is.mendelu.cz/auth/student/${uploadUrl}`;
            }

            const odevzdavarnaMatch = uploadUrl.match(/odevzdavarna=(\d+)/);
            const odevzdavarnaId = odevzdavarnaMatch ? odevzdavarnaMatch[1] : "";

            if (courseName && name) {
                assignments.push({ courseId, courseName, name, type, deadline, odevzdavarnaId, fileCount, uploadUrl });
            }
        }

        return assignments;
    } catch (error) {
        console.error("Error fetching odevzdavarny:", error);
        return null;
    }
}

export interface OdevzdavarnyResult {
    assignments: Odevzdavarna[];
    lastFetched: number;
}

export async function fetchOdevzdavarny(studium: string, obdobi: string): Promise<OdevzdavarnyResult | null> {
    const [czData, enData] = await Promise.all([
        fetchLang(studium, obdobi, 'cz'),
        fetchLang(studium, obdobi, 'en'),
    ]);

    if (!czData) return null;

    const merged: Odevzdavarna[] = czData.map((cz, i) => ({
        courseId: cz.courseId,
        courseNameCs: cz.courseName,
        courseNameEn: enData?.[i]?.courseName ?? cz.courseName,
        name: cz.name,
        type: cz.type,
        deadline: cz.deadline,
        odevzdavarnaId: cz.odevzdavarnaId,
        fileCount: cz.fileCount,
        uploadUrl: cz.uploadUrl,
    }));

    return { assignments: merged, lastFetched: Date.now() };
}
