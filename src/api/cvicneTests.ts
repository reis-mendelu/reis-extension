export interface CvicnyTest {
    courseId: string;
    courseNameCs: string;
    courseNameEn: string;
    name: string;
    url: string;
    status: 'accessible' | 'inaccessible';
}

interface RawTest {
    courseId: string;
    courseName: string;
    name: string;
    url: string;
    status: 'accessible' | 'inaccessible';
}

async function fetchLang(studium: string, lang: 'cz' | 'en'): Promise<RawTest[] | null> {
    try {
        const url = `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${studium};lang=${lang}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch seznam_osnov");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const table = doc.getElementById('tmtab_1');
        if (!table) return [];

        const rows = table.getElementsByTagName('tr');
        const tests: RawTest[] = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cols = row.getElementsByTagName('td');

            if (cols.length < 8) continue;

            // Sometimes the table has a "Poř." (Order) column at index 0, sometimes not.
            const offset = cols.length - 8;

            const courseLink = cols[offset + 0].getElementsByTagName('a')[0];
            const courseName = courseLink ? courseLink.textContent?.trim() || "" : cols[offset + 0].textContent?.trim() || "";

            const syllabusHref = courseLink?.getAttribute('href') || "";
            const predmetMatch = syllabusHref.match(/predmet=(\d+)/);
            const courseId = predmetMatch ? predmetMatch[1] : "";

            const osnovaName = cols[offset + 1].textContent?.trim() || "";

            const statusImg = cols[offset + 2].getElementsByTagName('img')[0];
            const statusSysId = statusImg?.getAttribute('sysid');
            const status: 'accessible' | 'inaccessible' = statusSysId === 'osnova-pristupna' ? 'accessible' : 'inaccessible';

            const linkElement = cols[offset + 7].getElementsByTagName('a')[0];
            let href = linkElement?.getAttribute('href') || "";

            if (href && !href.startsWith('http')) {
                href = `https://is.mendelu.cz${href.startsWith('/') ? '' : '/'}${href}`;
            }

            if (courseName && osnovaName && href) {
                tests.push({ courseId, courseName, name: osnovaName, url: href, status });
            }
        }

        return tests;
    } catch (error) {
        console.error("Error fetching cvicne testy:", error);
        return null;
    }
}

export interface CvicneTestsResult {
    tests: CvicnyTest[];
    lastFetched: number;
}

export async function fetchCvicneTests(studium: string): Promise<CvicneTestsResult | null> {
    const [czTests, enTests] = await Promise.all([
        fetchLang(studium, 'cz'),
        fetchLang(studium, 'en'),
    ]);

    if (!czTests) return null;

    const merged: CvicnyTest[] = czTests.map((czTest, i) => ({
        courseId: czTest.courseId,
        courseNameCs: czTest.courseName,
        courseNameEn: enTests?.[i]?.courseName ?? czTest.courseName,
        name: czTest.name,
        url: czTest.url,
        status: czTest.status,
    }));

    return { tests: merged, lastFetched: Date.now() };
}
