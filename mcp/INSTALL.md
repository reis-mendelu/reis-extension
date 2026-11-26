# reIS pro Claude: návod k instalaci

Claude si přečte tvůj rozvrh, zkoušky, známky, termíny odevzdání i soubory z předmětů v IS Mendelu a odpoví na otázky typu „co mám tenhle týden odevzdat?“ nebo „vysvětli mi přednášku 7 z Počítačových sítí“. Všechno běží na tvém počítači. Claude je **jen čte**, nikam tě nepřihlásí a nic neodevzdá.

Potřebuješ účet Claude ([claude.ai](https://claude.ai)) a počítač (macOS nebo Windows). Nainstaluj si **jednu** ze dvou variant.

## Varianta A: Claude Desktop (doporučeno)

> **Poznámka:** soubor `.mcpb` zatím nemá zveřejněnou verzi na stránce verzí. Dokud ji nezveřejníme, použij variantu B.

1. Nainstaluj si [Claude Desktop](https://claude.ai/download) a přihlas se.
2. Stáhni [`reis-for-claude.mcpb`](https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb) (návod s obrázky: [reisapp.cz/navody/reis-v-claude](https://reisapp.cz/navody/reis-v-claude)).
3. Dvakrát na něj klikni (nebo ho přetáhni do okna Claude Desktop) a potvrď **Install**.
4. Zadej své přihlašovací jméno do IS (např. `xnovak`) a heslo. Heslo se uloží do klíčenky systému a odesílá se **jen** na `is.mendelu.cz`.
5. Založ nový chat a zeptej se: „Jaké zkoušky mě ještě čekají?“

## Varianta B: Claude Code (pro ty, kdo ho už používají)

1. Ověř, že v terminálu funguje `node --version` (potřebuješ Node.js 20 nebo novější z [nodejs.org](https://nodejs.org)).
2. V Claude Code spusť:

   ```
   /plugin marketplace add reis-mendelu/reis-for-claude
   /plugin install reis@reis
   ```

3. Pokud Claude Code nabídne výběr rozsahu instalace, zvol uživatelský (User), pak zadej přihlašovací jméno a heslo do IS.

## Co to umí

Rozvrh na 14 dní dopředu, zkouškové termíny, předměty a studijní plán, sylaby, známky a kredity, termíny odevzdávárny, soubory z dokumentových složek předmětů (Claude je umí přečíst) a historickou úspěšnost předmětů.

## Aktualizace

Dokud reIS for Claude není v adresáři Claude, aktualizuje se ručně: stáhni nový `.mcpb` a otevři ho znovu. Když vyjde nová verze, reIS ti to napíše pod odpověď; zjišťuje to jednou při startu dotazem na `api.github.com` bez přihlášení a bez dat z IS (GitHub vidí jen tvou IP adresu, jako každý web). Plugin pro Claude Code aktualizuješ dvěma kroky: `/plugin marketplace update reis` obnoví seznam a `claude plugin update reis@reis` (v terminálu) aktualizuje samotný plugin; poté restartuj Claude Code.

## Když něco nejde

- **Špatné heslo:** oprav ho v nastavení rozšíření reIS v Claude Desktop. Špatné heslo se samo neopakuje, aby se ti nezamkl účet.
- **Dvoufázové přihlášení** zatím není podporované.
- **Nic se nestalo po dvojkliku:** zkus soubor přetáhnout do okna Claude Desktop.
- Cokoli dalšího: [napiš nám](https://github.com/reis-mendelu/reis-for-claude/issues).

## Co se ukládá do tvého počítače

Aby Claude nezačínal pokaždé od nuly, reIS pro Claude si u tebe v počítači ukládá kopii toho, co Claude přečetl: seznam tvých předmětů, seznam souborů každého předmětu (názvy, data, odkazy ke stažení), **celý text** souborů, které Claude otevřel (v Claude Code jen textových souborů), **původní soubory** předmětů tak, jak je IS posílá (PDF, prezentace, zipy zabalené, datové soubory): ten, který Claude otevře, a na požádání všechny najednou přes `mendelu_build_my_map` (nejdřív zkušební běh, který nic nestahuje a řekne jen počty a typy souborů; velikost předem známá není, IS ji neuvádí), Claude je pak otevírá přímo z disku, tvůj studijní program, formu, ročník a semestr, **seznam nadcházejících událostí** (testy, zápočty, obhajoby, dny programu), který si vede Claude přes `mendelu_ledger` (název, datum, předmět, místnost, pravidlo a odkud datum je; zapisuje ho Claude, reIS jen ukládá a do žádného kalendáře nic nezapisuje), a krátký záznam toho, co ti `mendelu_overview` naposledy hlásil jako novinku (název a datum souborů, otisk každého řádku bodů (body samotné se v čitelné podobě neukládají), názvy a termíny odevzdávárny, termíny zkoušek). **Neukládá** heslo ani přihlašovací cookie z IS; studijní profil neobsahuje jméno, osobní číslo ani e-mail, ale názvy a obsah souborů se ukládají tak, jak jsou, takže se uloží i to, co je v nich napsané. Je to zapnuté ve výchozím stavu a nic z toho neodchází z počítače. Složka je jedna na uživatelský účet v počítači (sdílí ji Claude Desktop i Claude Code): macOS `~/Library/Application Support/reIS for Claude`, Windows `%LOCALAPPDATA%\reIS for Claude`. Zabere nejvýš 4 GB, pak se mažou nejstarší kopie, nejdřív původní soubory. Smažeš ji tak, že Claudovi napíšeš „zapomeň všechno, co reIS uložil“ (spustí `mendelu_forget_everything`, smaže i původní soubory), nebo složku smažeš sám. Odinstalování rozšíření ji nesmaže.

## Soukromí

reIS o tobě nedostane nic. Co Claude přečte, jde do tvého chatu s Claude jako cokoli jiného, co tam sdílíš. Podrobnosti: [PRIVACY.md](https://github.com/reis-mendelu/reis-for-claude/blob/main/PRIVACY.md). Neoficiální projekt, IS Mendelu patří Mendelově univerzitě v Brně.

---

# reIS for Claude: install guide (English)

Claude reads your IS Mendelu timetable, exams, grades, deadlines and subject files, and answers questions about them. It runs on your own computer and is strictly read-only.

*Note: no `.mcpb` release has been published on the releases page yet; until one is, use the Claude Code route.*

**Claude Desktop (recommended):** install [Claude Desktop](https://claude.ai/download), download `reis-for-claude.mcpb` from the [latest release](https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb), double-click it (or drag it into Claude Desktop), enter your IS username and password, then ask "what exams do I have left?".

**Claude Code:** with Node.js 20+ installed, run `/plugin marketplace add reis-mendelu/reis-for-claude`, then `/plugin install reis@reis`, and enter your IS login when asked.

**What it saves on your computer:** a local copy of what Claude read, so it does not start from zero each time: your subject list, each subject's file list (names, dates, download links), the full text of files Claude opened (in Claude Code only plain-text files), the **original files** of your subjects exactly as IS serves them (PDFs, slides, zips still zipped, data files): the one Claude opens, and all of them when you ask with `mendelu_build_my_map` (a dry run first that downloads nothing and gives only counts and types; IS lists no sizes), which Claude then opens from disk, your study programme, form, year and semester, the list of upcoming events (tests, credit tests, defences, programme days) Claude keeps with `mendelu_ledger` (title, date, subject, room, the rule that matters, where the date came from; Claude writes it, reIS only stores it and never writes to a calendar), and a short record of what `mendelu_overview` last told Claude was new (each file's name and date, a fingerprint of each row of your points rather than the points themselves, assignment names and deadlines, exam term dates) (your points are not saved in readable form, only a fingerprint). Never your password or IS's sign-in cookie; the study profile holds no name, student number or e-mail, but file names and contents are kept as they are, so anything written in them is kept too. On by default, never leaves your computer. One folder per computer account, shared by Claude Desktop and Claude Code: macOS `~/Library/Application Support/reIS for Claude`, Windows `%LOCALAPPDATA%\reIS for Claude`. Up to 4 GB, then the oldest copies go, original files first. Delete it by asking Claude to "forget everything reIS saved" (it runs `mendelu_forget_everything`, original files included) or by deleting the folder; uninstalling does not remove it.

Updates are manual for the `.mcpb` (download and open the new file; once per start it asks `api.github.com`, with no login or IS data (GitHub sees your IP address), whether a newer release exists, and says so under its answers); the plugin takes two steps: `/plugin marketplace update reis` refreshes the listing, then `claude plugin update reis@reis` (in a terminal) updates the plugin itself; restart Claude Code afterwards. Two-factor IS accounts are not supported yet.
