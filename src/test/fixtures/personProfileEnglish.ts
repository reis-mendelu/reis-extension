/**
 * Real `clovek.pl` markup in ENGLISH, fetched 2026-08-14 from
 * `https://is.mendelu.cz/auth/lide/clovek.pl?id=<id>;lang=en`.
 *
 * These are the evidence for teaching the parser the English page (#206). The
 * Czech twins already live in `personProfileTeacher.ts` and in
 * `src/api/__tests__/fixtures/clovek-janda.html`, so every assertion below has
 * a matched pair and a language flip can be proven not to lose a field.
 *
 * Verbatim apart from the page chrome (head, nav, portlets, footer) and the
 * same redactions the Czech teacher fixture carries — this repo is public and
 * IS's person page is not. Synthetic values keep the SHAPE the parser reads: a
 * `[at]`-obfuscated address beside a real `mailto:`, a `+420` number, a
 * value-only row under a label. What stays real is what the university itself
 * publishes (name, university e-mail, roles, office, programme).
 *
 * What the English page changes, and what it does not:
 *
 *  - EVERY contact label is different. "Telefon do zaměstnání" is "Office phone
 *    number", "Označení kanceláře" is "Office number", "Konzultační hodiny" is
 *    "Consulting hours", "Adresa pracoviště" is "Office address". A parser that
 *    looks up Czech labels finds nothing and returns nulls — which is why
 *    simply flipping `lang=en` would have been worse than the Czech-only bug.
 *  - The study sentences are translated too: "Bakalářský typ studia, prezenční
 *    forma" becomes "Bachelor type of study, full-time form", and "1. ročník /
 *    2. semestr studia" becomes "1st year of study / 2nd semester of study".
 *    Note the ORDINAL SUFFIXES — "1st", "2nd" — which no Czech-shaped `\d+\.`
 *    pattern matches.
 *  - Structure is untouched: same `td.odsazena` two-column contact table, same
 *    `pracoviste.pl` anchor marking a role line, same office cell carrying both
 *    "BA39N2056 (Q2.56)" as text and `placeName=Q2.56` in the href, same
 *    `nova_zprava.pl?uzivatel=<id>` anchor for the university e-mail. So every
 *    SELECTOR survives the flip and only the VOCABULARY had to learn English.
 */

/** Teacher (staff) profile — roles, office, consultation hours. */
export const TEACHER_PROFILE_HTML_EN = `
<table><tbody ><tr class="" ><td class="odsazena" valign="top" width="250" align="left"><img src="foto.pl?id=18583;lang=en" width="154" height="192" alt=""   /></td><td class="odsazena" valign="top" align="left"><table><tbody ><tr class="" ><td class="odsazena" align="left"><b><font size="+1">Ing. David Procházka, Ph.D.</font></b></td></tr><tr class="" ><td class="odsazena" align="left">Identification number: 18583</td></tr><tr class="" ><td class="odsazena" align="left">University e-mail: <a href="../posta/nova_zprava.pl?uzivatel=18583;lang=en">david.prochazka [at] mendelu.cz</a></td></tr><tr class="" ><td class="odsazena" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">Assistant Professor - <a href="../pracoviste/pracoviste.pl?id=8;nerozbaluj=1;lang=en">Department of Informatics (FBE)</a></td></tr><tr class="" ><td class="odsazena" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">External Instructor - <a href="../pracoviste/pracoviste.pl?id=204;nerozbaluj=1;lang=en">Department of Forest Management and Applied Geoinformatics (FFWT)</a></td></tr></tbody></table><p></p></td></tr></tbody></table>
<table><tbody ><tr class="" ><td class="odsazena" colspan="2" align="left">User forwards the university mail to a&nbsp;different address.</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">User active bank account provided.</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">Personal number:</td><td class="odsazena" align="left">0000 (DI FBE)</td></tr><tr class="" ><td class="odsazena" align="left">Office phone number:</td><td class="odsazena" align="left">+420 500 000 000</td></tr><tr class="" ><td class="odsazena" align="left">Office address: </td><td class="odsazena" align="left">DI FBE, Zemědělská 1, 61300 Brno</td></tr><tr class="" ><td class="odsazena" align="left">Office number:</td><td class="odsazena" align="left"><a href="https://mm.mendelu.cz/mapwidget/embed?placeName=Q2.56" onclick="return false" >BA39N2056 (Q2.56)</a> <a href="https://mm.mendelu.cz/mapwidget/embed?placeName=Q2.56" onclick="return false" ><span class="uf-icon xs" role="img" data-sysid="zobrazit-mapu" data-id="1613" aria-label="Display a&nbsp;map" title="Display a&nbsp;map"></span></a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Private e-mail:</td><td class="odsazena" align="left"><a href="mailto:test.osoba@example.com">test.osoba [at] example.com</a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Web page address:</td><td class="odsazena" align="left"><a href="https://spatialhub.mendelu.cz" target="_blank">https://spatialhub.mendelu.cz</a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Key word:</td><td class="odsazena" align="left">GIS, iOS, Metaverse, Spatial Hub, virtual reality</td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Address:</td><td class="odsazena" align="left">Testov</td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Consulting hours:</td><td class="odsazena" align="left">Please, use <a href="https://outlook.office.com/bookwithme/user/x/meetingtype/y?anonymous&amp;ep=mlink">Bookings</a> for reservation of a&nbsp;consultation with me.</td></tr></tbody></table>
`;

/** Student profile — programme, study type and year/semester sentences. */
export const STUDENT_PROFILE_HTML_EN = `
<table><tbody ><tr class="" ><td class="odsazena" valign="top" width="250" align="left"><img src="foto.pl?id=120349;lang=en" width="154" height="192" alt=""   /></td><td class="odsazena" valign="top" align="left"><table><tbody ><tr class="" ><td class="odsazena" align="left"><b><font size="+1">Kryštof Janda</font></b></td></tr><tr class="" ><td class="odsazena" align="left">Identification number: 120349</td></tr><tr class="" ><td class="odsazena" align="left">University e-mail: <a href="../posta/nova_zprava.pl?uzivatel=120349;lang=en">xjanda [at] node.mendelu.cz</a></td></tr><tr class="" ><td class="odsazena" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left"><b>B0613A140025&nbsp;&nbsp;Open Informatics B-OI</b></td></tr><tr class="" ><td class="odsazena" align="left">FBE B-OI-ZBOI pres [term 2, year 1]</td></tr><tr class="" ><td class="odsazena" align="left">Bachelor type of study, full-time form</td></tr><tr class="" ><td class="odsazena" align="left">1st year of study / 2nd semester of study</td></tr></tbody></table><p></p></td></tr></tbody></table>
<table><tbody ><tr class="" ><td class="odsazena" colspan="2" align="left">User forwards the university mail to a&nbsp;different address (distribution server&nbsp;office365).</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Private e-mail:</td><td class="odsazena" align="left"><a href="mailto:test.student@example.com">test.student [at] example.com</a></td></tr></tbody></table>
`;
