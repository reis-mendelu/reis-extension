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
