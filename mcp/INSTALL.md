# reIS pro Claude: návod k instalaci

Claude si přečte tvůj rozvrh, zkoušky, známky, termíny odevzdání i soubory z předmětů v IS Mendelu a odpoví na otázky typu „co mám tenhle týden odevzdat?“ nebo „vysvětli mi přednášku 7 z Počítačových sítí“. Všechno běží na tvém počítači. Claude je **jen čte**, nikam tě nepřihlásí a nic neodevzdá.

Potřebuješ účet Claude ([claude.ai](https://claude.ai)) a počítač (macOS nebo Windows). Nainstaluj si **jednu** ze dvou variant.

## Varianta A: Claude Desktop (doporučeno)

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
4. Zapni automatické aktualizace: spusť `/plugin`, vyber **Marketplaces**, pak **reis** a **Enable auto-update**. Claude Code pak při startu sám stáhne novou verzi.

## Co to umí

Rozvrh na 14 dní dopředu, zkouškové termíny, předměty a studijní plán, sylaby, známky a kredity, termíny odevzdávárny, soubory z dokumentových složek předmětů (Claude je umí přečíst) a historickou úspěšnost předmětů.

## Aktualizace

Nová verze vychází spolu s aplikací reIS, kdykoli se reIS pro Claude změnil.

- **Claude Desktop** soubor `.mcpb` sám neaktualizuje. Když vyjde nová verze, reIS ti to napíše pod odpověď; stáhni nový `.mcpb` stejným odkazem a otevři ho znovu. Že je venku nová verze, zjišťuje jednou při startu dotazem na `api.github.com` bez přihlášení a bez dat z IS (GitHub vidí jen tvou IP adresu, jako každý web).
- **Claude Code** se aktualizuje sám, pokud máš zapnuté automatické aktualizace (krok 4 výše). Ručně: `/plugin marketplace update reis` a pak `claude plugin update reis@reis` v terminálu; poté restartuj Claude Code.

## Když něco nejde

- **Špatné heslo:** oprav ho v nastavení rozšíření reIS v Claude Desktop. Špatné heslo se samo neopakuje, aby se ti nezamkl účet.
- **Dvoufázové přihlášení** zatím není podporované.
- **Nic se nestalo po dvojkliku:** zkus soubor přetáhnout do okna Claude Desktop.
- Cokoli dalšího: [napiš nám](https://github.com/reis-mendelu/reis-for-claude/issues).

## Soukromí

reIS o tobě nedostane nic. Co Claude přečte, jde do tvého chatu s Claude jako cokoli jiného, co tam sdílíš. Podrobnosti: [PRIVACY.md](https://github.com/reis-mendelu/reis-for-claude/blob/main/PRIVACY.md). Neoficiální projekt, IS Mendelu patří Mendelově univerzitě v Brně.

---

# reIS for Claude: install guide (English)

Claude reads your IS Mendelu timetable, exams, grades, deadlines and subject files, and answers questions about them. It runs on your own computer and is strictly read-only.

**Claude Desktop (recommended):** install [Claude Desktop](https://claude.ai/download), download `reis-for-claude.mcpb` from the [latest release](https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb), double-click it (or drag it into Claude Desktop), enter your IS username and password, then ask "what exams do I have left?".

**Claude Code:** with Node.js 20+ installed, run `/plugin marketplace add reis-mendelu/reis-for-claude`, then `/plugin install reis@reis`, and enter your IS login when asked. Then turn on auto-update: `/plugin` → **Marketplaces** → **reis** → **Enable auto-update**.

New versions come out with the reIS app whenever reIS for Claude changed. Claude Desktop does not update a `.mcpb` by itself: once per start it asks `api.github.com`, with no login or IS data (GitHub sees your IP address), whether a newer release exists and says so under its answers; download it from the same link and open it again. With auto-update on, Claude Code updates the plugin itself at startup (by hand: `/plugin marketplace update reis`, then `claude plugin update reis@reis` in a terminal, and restart). Two-factor IS accounts are not supported yet.
