import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../../api/client', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args),
  BASE_URL: 'https://is.mendelu.cz',
}));

const { fetchUserBaseIds, fetchUserNetId } = await import('../fetchers');

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

  // IS ČZU (same UIS, older header) greets in a div, and the name is followed
  // by `</div>`, not by `&nbsp;`. Markup from a real is.czu.cz studium.pl,
  // October 2026, identity replaced.
  it('reads the name from the IS ČZU header', async () => {
    respond(`
<html><body>
<a href="/auth/student/studium.pl?studium=358180;obdobi=1327;lang=cz">x</a>
<div id="menu_top"> <div id="log"> Přihlášen:&nbsp;Jan Novák </div> <div id="ema"><a href="/auth/posta/">0 zpráv</a></div></div>
${ID_ROW('Identifikační číslo uživatele: ', '120344')}
</body></html>`);
    const params = await fetchUserBaseIds();
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });

  // InSIS VŠE puts the greeting in <strong> inside span#logs. Markup from a
  // real insis.vse.cz studium.pl, November 2026, identity replaced.
  it('reads the name from the InSIS VŠE header', async () => {
    respond(`
<html><body>
<a href="/auth/student/studium.pl?studium=358180;obdobi=1278;lang=cz">x</a>
<span id="logs"> <strong> Přihlášen:</strong>&nbsp;Jan Novák</span> <ul> <li><a href="https://outlook.com/vse.cz">Office365</a></li></ul>
${ID_ROW('Identifikační číslo uživatele: ', '120344')}
</body></html>`);
    const params = await fetchUserBaseIds();
    expect(params?.fullName).toBe('Jan Novák');
  });

  // The UIS redesign live on is.mendelu.cz since November 2026 drops the
  // `Přihlášen:` greeting altogether. The name now sits in the menu popup's
  // `.user-info` link (and again, bare, in the header's `.info`). Markup from a
  // real studium.pl, 2026-11-15, svg icons cut and identity replaced. Without
  // this the app showed the student's number where the name belongs.
  it.each([
    ['cz', 'Identifikační číslo uživatele: ', 'PEF B-OI-ZBOI prez [sem 3, roč 2]'],
    ['en', "User's identification number: ", 'FBE B-OI-ZBOI pres [term 3, year 2]'],
  ])('reads the name from the redesigned %s header', async (lang, idLabel, ident) => {
    respond(`
<html><body data-body> <div class="wholepage"><div id="menu-popup" data-active="false" data-page="1"><div class="menu-pages"><div class="items" data-page="1"><div class="user-info"><a target="_blank" href="/auth/lide/clovek.pl?id=120344;lang=${lang}">Jan Novák</a><div title="${ident}" class="ident">${ident}</div></div></div></div></div>
<div id="header"><div class="left">Mendelova univerzita v Brně</div><div class="right"><div class="info"><div >Leopold</div><div title="">15. 11. 2026&nbsp;21:23</div><div class="dvdr"></div><div >Jan Novák</div></div><div id="pfp"><img alt="" src="/auth/lide/foto.pl?id=120344;lang=${lang}"/></div></div></div>
<a href="https://is.mendelu.cz/auth/student/studium.pl?studium=150001;obdobi=829;lang=sk" title="SK">sk</a>
${ID_ROW(idLabel, '120344')}
</body></html>`);
    const params = await fetchUserBaseIds();
    expect(params).toMatchObject({ studium: '150001', obdobi: '829' });
    expect(params?.studentId).toBe('120344');
    expect(params?.fullName).toBe('Jan Novák');
  });
});

// The redesign writes `<b >`. Shape from a real certifikat.pl, 2026-11-15,
// username replaced. Without it the eduroam screen had no network username.
describe('fetchUserNetId', () => {
  it.each([
    'Můžete si vygenerovat nový certifikát pro uživatele <b >xnovak1</b> s&nbsp;délkou platnosti 366 dní',
    'You can generate a&nbsp;new certificate for user <b >xnovak1</b> valid for 366 days',
    'Můžete si vygenerovat nový certifikát pro uživatele <b>xnovak1</b> s&nbsp;délkou',
  ])('reads the username from %s', async (html) => {
    respond(`<html><body>${html}</body></html>`);
    expect(await fetchUserNetId()).toEqual({ username: 'xnovak1' });
  });
});
