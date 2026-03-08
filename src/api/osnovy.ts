

export interface OsnovaTest {
    courseName: string;
    name: string;
    url: string;
    status: 'accessible' | 'inaccessible';
}

export interface OsnovyResult {
    tests: OsnovaTest[];
    lastFetched: number;
}

export async function fetchOsnovy(studium: string): Promise<OsnovyResult | null> {
    try {
        const url = `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${studium};lang=cz`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch seznam_osnov");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        // The tests are stored in table#tmtab_1
        const table = doc.getElementById('tmtab_1');
        if (!table) return { tests: [], lastFetched: Date.now() };

        const rows = table.getElementsByTagName('tr');
        const tests: OsnovaTest[] = [];

        // Skip the header row (i = 1)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cols = row.getElementsByTagName('td');
            
            if (cols.length < 8) continue;

            // Sometimes the table has a "Poř." (Order) column at index 0, sometimes not.
            // If length is 9, offset is 1. If length is 8, offset is 0.
            const offset = cols.length - 8;

            const courseLink = cols[offset + 0].getElementsByTagName('a')[0];
            const courseName = courseLink ? courseLink.textContent?.trim() || "" : cols[offset + 0].textContent?.trim() || "";
            
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
                tests.push({
                    courseName,
                    name: osnovaName,
                    url: href,
                    status
                });
            }
        }

        return {
            tests,
            lastFetched: Date.now()
        };



    } catch (error) {
        console.error("Error fetching osnovy:", error);
        return null;
    }
}
