import { fetchWithAuth, BASE_URL } from "../../api/client";

export async function fetchUserBaseIds() {
    const res = await fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`), h = await res.text();
    const m = h.match(/studium=(\d+);obdobi=(\d+)/), idm = h.match(/Identifikační\s+číslo\s+uživatele:\s*<\/td>\s*<td[^>]*>\s*(\d+)/i);
    const nm = h.match(/id="prihlasen"[^>]*>\s*Přihlášen:&nbsp;([^&]+)/i);
    
    // Stricter Erasmus detection: 
    // Usually, Erasmus students have 'Erasmus+' in their study program name or a specific active study row.
    // We sanitize the HTML by removing sidebars (e.g., Zapsané termíny) that might contain course names with "Erasmus".
    const sanitizedHtml = h.replace(/<div class="sideportlet">[\s\S]*?<\/div>/g, '');
    
    const isErasmus =
        /Erasmus\s*\+/i.test(sanitizedHtml) ||
        /exchange\s+programs?/i.test(sanitizedHtml) ||
        /výměnné\s+programy/i.test(sanitizedHtml);

    return m ? { 
        studium: m[1], 
        obdobi: m[2], 
        studentId: idm ? idm[1] : '', 
        fullName: nm ? nm[1].trim() : '', 
        isErasmus, 
        html: h 
    } : null;
}

export async function fetchUserStudyDetails() {
    const res = await fetchWithAuth(`${BASE_URL}/auth/student/moje_studium.pl?lang=cz`), h = await res.text();
    const doc = new DOMParser().parseFromString(h, 'text/html'), t = doc.querySelector('#titulek');
    let sc = '', fl, sp, sf, ss, sy, pl;
    if (t) {
        const b = t.querySelectorAll('b');
        if (b.length > 0) {
            sc = b[0].textContent?.trim() || '';
            const m = sc.match(/^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\[sem\s+(\d+),\s+roč\s+(\d+)\]/);
            if (m) { fl = m[1]; sp = m[2]; sf = m[3]; ss = parseInt(m[4]); sy = parseInt(m[5]); }
        }
        if (b.length > 1) pl = b[1].textContent?.trim().split(' - ')[0] || '';
    }
    return { facultyId: '', facultyLabel: fl, studyCode: sc, studyProgram: sp, studyForm: sf, studySemester: ss, studyYear: sy, periodLabel: pl };
}

export async function fetchUserNetId() {
    const res = await fetchWithAuth(`${BASE_URL}/auth/wifi/certifikat.pl?_m=177`), h = await res.text();
    const m = h.match(/pro uživatele <b>([^<]+)<\/b>/i) || h.match(/for user <b>([^<]+)<\/b>/i);
    return { username: m ? m[1] : '' };
}
