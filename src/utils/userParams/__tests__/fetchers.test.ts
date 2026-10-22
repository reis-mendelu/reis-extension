import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../../api/client', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args),
  BASE_URL: 'https://is.mendelu.cz',
}));

const { fetchUserBaseIds } = await import('../fetchers');

/**
 * Both fixtures are the real `studium.pl` markup, with the identity values
 * replaced. The English one is the shape recovered from a device that had
 * silently been storing an empty `studentId` and `fullName` for weeks: IS
 * serves this page in whichever language the SESSION is in, and the two
 * regexes only ever spoke Czech, so both fields fell back to '' while
 * `studium`/`obdobi` — which carry no words — kept parsing fine.
 */
const ID_ROW = (label: string, id: string) =>
  `<table><tbody ><tr class="" ><td class="odsazena" align="left">${label}</td><td class="odsazena" align="left">${id}</td></tr></tbody></table>`;

const page = (opts: { greeting: string; idLabel: string; name: string; id: string }) => `
<html><body>
<a href="/auth/student/studium.pl?studium=149707;obdobi=812;lang=cz">x</a>
<div id="horni-navigace"><table border="0">
  <tr><td id="prihlasen">
               ${opts.greeting}&nbsp;${opts.name}&nbsp;&nbsp;&nbsp;&nbsp;<a href="/auth/system/logout.pl">out</a>
</td></tr></table></div>
${ID_ROW(opts.idLabel, opts.id)}
</body></html>`;

const respond = (html: string) => {
  fetchWithAuth.mockResolvedValue({ text: () => Promise.resolve(html) });
};

describe('fetchUserBaseIds', () => {
  beforeEach(() => fetchWithAuth.mockReset());

  it('reads the id and the name from a Czech page', async () => {
    respond(
      page({
        greeting: 'Přihlášen:',
        idLabel: 'Identifikační číslo uživatele: ',
        name: 'Jan Novák',
        id: '120344',
      })
    );
    const params = await fetchUserBaseIds();
    expect(params).toMatchObject({ studium: '149707', obdobi: '812' });
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });

  // IS greets a female student in the feminine: `Přihlášena:`, read off two
  // students' real Czech pages (October 2026). The regex only knew the
  // masculine form, so every woman in a Czech session got fullName '' — no name
  // on the profile, and an identity that never counted as complete, which sent
  // every boot down the full rebuild path.
  it('reads the name from a Czech page that greets a female student', async () => {
    respond(
      page({
        greeting: 'Přihlášena:',
        idLabel: 'Identifikační číslo uživatele: ',
        name: 'Jana Nováková',
        id: '120345',
      })
    );
    const params = await fetchUserBaseIds();
    expect(params?.studentId).toBe('120345');
    expect(params?.fullName).toBe('Jana Nováková');
  });

  // One study: no switcher on the page, so nothing to choose — and the same
  // single request it always was.
  it('reports no studies to choose from when IS shows no switcher', async () => {
    respond(
      page({
        greeting: 'Přihlášen:',
        idLabel: 'Identifikační číslo uživatele: ',
        name: 'Jan Novák',
        id: '1',
      })
    );
    const params = await fetchUserBaseIds();
    expect(params?.studies).toEqual([]);
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWithAuth).toHaveBeenCalledWith('https://is.mendelu.cz/auth/student/studium.pl');
  });

  it("reads one study's own page in Czech, with its switcher and status", async () => {
    respond(
      page({
        greeting: 'Přihlášena:',
        idLabel: 'Identifikační číslo uživatele: ',
        name: 'Jana',
        id: '2',
      })
        .replace('studium=149707;obdobi=812', 'studium=900002;obdobi=829')
        .replace(
          '</body>',
          '<select name="studium"><option value="900001">PEF B-EKO komb [sem 1, roč 1]</option>' +
            '<option value="900002" selected="selected">PEF B-OI prez [sem 3, roč 2]</option></select>' +
            '<table><tr><td class="odsazena">Stav studia: </td><td class="odsazena">řádně zapsán</td></tr></table></body>'
        )
    );
    const params = await fetchUserBaseIds('900002');
    expect(fetchWithAuth).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/studium.pl?studium=900002;lang=cz'
    );
    expect(params).toMatchObject({ studium: '900002', obdobi: '829', studyStatus: 'řádně zapsán' });
    expect(params?.studies.map((s) => s.studium)).toEqual(['900001', '900002']);
  });

  // The regression. An English session made the profile photo unreachable —
  // PersonPhoto is handed `studentId`, and '' resolves to no photo at all.
  it('reads the id and the name from an English page', async () => {
    respond(
      page({
        greeting: 'Logged in:',
        idLabel: "User's identification number: ",
        name: 'Jan Novák',
        id: '120344',
      })
    );
    const params = await fetchUserBaseIds();
    expect(params).toMatchObject({ studium: '149707', obdobi: '812' });
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });
});
