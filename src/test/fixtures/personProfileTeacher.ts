/**
 * Real `clovek.pl` markup for a MENDELU teacher, fetched 2026-08-09 from
 * `https://is.mendelu.cz/auth/lide/clovek.pl?id=18583;lang=cz`.
 *
 * Verbatim apart from the page chrome (head, nav, portlets, footer) and from
 * the redactions listed below — the two tables are otherwise exactly what IS
 * served. Parser changes need a real sample as evidence; this is it.
 *
 * REDACTED, because this repo is public and IS's person page is not: the
 * private e-mail (anchor text AND mailto href), the residence, the personal
 * number and the work phone now carry synthetic values. Their SHAPE is
 * untouched, which is all the parser reads — a `[at]`-obfuscated address next
 * to a real `mailto:`, a value-only row under a label, a `+420` number. What is
 * kept real is what the university itself publishes in its people directory
 * (name, university e-mail, roles, workplace, office) and what the parser is
 * actually being pinned against.
 *
 * The shapes that matter, and why each is easy to get wrong:
 *
 *  - the role lines are plain `td.odsazena` rows in the HEADER table, with the
 *    department as an anchor to `pracoviste.pl` — there is no label column;
 *  - the contact table below is two-column, label then value, and blank
 *    spacer rows carry `colspan="2"`;
 *  - the office cell holds BOTH codes: the anchor text is
 *    "BA39N2056 (Q2.56)" and the href carries `placeName=Q2.56`. The campus
 *    map's room index keys on `code` ("BA39N2056") with `name` "Q2.56", so
 *    either resolves — but only if both are extracted.
 */
export const TEACHER_PROFILE_HTML = `
<table><tbody ><tr class="" ><td class="odsazena" valign="top" width="250" align="left"><img src="foto.pl?id=18583;lang=cz" width="154" height="192" alt=""   /></td><td class="odsazena" valign="top" align="left"><table><tbody ><tr class="" ><td class="odsazena" align="left"><b><font size="+1">Ing. David Procházka, Ph.D.</font></b></td></tr><tr class="" ><td class="odsazena" align="left">Identifikační číslo: 18583</td></tr><tr class="" ><td class="odsazena" align="left">Univerzitní e-mail: <a href="../posta/nova_zprava.pl?uzivatel=18583;lang=cz">david.prochazka [at] mendelu.cz</a></td></tr><tr class="" ><td class="odsazena" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">Akademický pracovník - odborný asistent - <a href="../pracoviste/pracoviste.pl?id=8;nerozbaluj=1;lang=cz">Ústav informatiky (PEF)</a></td></tr><tr class="" ><td class="odsazena" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">Externí školitel - <a href="../pracoviste/pracoviste.pl?id=204;nerozbaluj=1;lang=cz">Ústav hospodářské úpravy lesů a&nbsp;aplikované geoinformatiky (LDF)</a></td></tr></tbody></table><p></p></td></tr></tbody></table>
<table><tbody ><tr class="" ><td class="odsazena" colspan="2" align="left">Uživatel si přeposílá univerzitní poštu jinam.</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">Uživatel má zadáno aktivní bankovní spojení.</td></tr><tr class="" ><td class="odsazena" colspan="2" align="left">&nbsp;</td></tr><tr class="" ><td class="odsazena" align="left">Osobní číslo:</td><td class="odsazena" align="left">0000 (ÚI PEF)</td></tr><tr class="" ><td class="odsazena" align="left">Telefon do zaměstnání:</td><td class="odsazena" align="left">+420 500 000 000</td></tr><tr class="" ><td class="odsazena" align="left">Adresa pracoviště: </td><td class="odsazena" align="left">ÚI PEF, Zemědělská 1, 61300 Brno</td></tr><tr class="" ><td class="odsazena" align="left">Označení kanceláře:</td><td class="odsazena" align="left"><a href="https://mm.mendelu.cz/mapwidget/embed?placeName=Q2.56" onclick="return false" >BA39N2056 (Q2.56)</a> <a href="https://mm.mendelu.cz/mapwidget/embed?placeName=Q2.56" onclick="return false" ><span class="uf-icon xs" role="img" data-sysid="zobrazit-mapu" data-id="1613" aria-label="Zobrazit mapu" title="Zobrazit mapu"></span></a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Soukromý e-mail:</td><td class="odsazena" align="left"><a href="mailto:test.osoba@example.com">test.osoba [at] example.com</a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Adresa webové stránky:</td><td class="odsazena" align="left"><a href="https://spatialhub.mendelu.cz" target="_blank">https://spatialhub.mendelu.cz</a></td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Klíčové slovo:</td><td class="odsazena" align="left">GIS, iOS, Laboratoř virtuální reality, LBS, Metaverse, rozšířená realita, Spatial Hub, virtuální realita, virtual reality</td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Bydliště:</td><td class="odsazena" align="left">Testov</td></tr><tr class="" ><td class="odsazena" valign="top" align="left">Konzultační hodiny:</td><td class="odsazena" align="left">Konzultaci si prosím rezervujte online přes <a href="https://outlook.office.com/bookwithme/user/x/meetingtype/y?anonymous&amp;ep=mlink">Bookings</a>.</td></tr></tbody></table>
`;
