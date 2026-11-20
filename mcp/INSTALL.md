# reIS pro Claude: návod k instalaci

Claude si přečte tvůj rozvrh, zkoušky, známky, termíny odevzdání i soubory z předmětů v IS Mendelu a odpoví na otázky typu „co mám tenhle týden odevzdat?“ nebo „vysvětli mi přednášku 7 z Počítačových sítí“. Všechno běží na tvém počítači. Claude je **jen čte**, nikam tě nepřihlásí a nic neodevzdá.

Potřebuješ účet Claude ([claude.ai](https://claude.ai)) a počítač (macOS nebo Windows). Nainstaluj si **jednu** ze dvou variant.

## Varianta A: Claude Desktop (doporučeno)

> **Poznámka:** soubor `.mcpb` zatím nemá zveřejněnou verzi na stránce verzí. Dokud ji nezveřejníme, použij variantu B.

1. Nainstaluj si [Claude Desktop](https://claude.ai/download) a přihlas se.
2. Otevři [stránku s verzemi](https://github.com/reis-mendelu/reis-extension/releases) a v nejnovější verzi nazvané **reIS for Claude** (štítek `mcp-v…`) stáhni soubor `reis-for-claude.mcpb`.
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

Dokud reIS for Claude není v adresáři Claude, aktualizuje se ručně: stáhni nový `.mcpb` a otevři ho znovu. Plugin pro Claude Code aktualizuješ dvěma kroky: `/plugin marketplace update reis` obnoví seznam a `claude plugin update reis@reis` (v terminálu) aktualizuje samotný plugin; poté restartuj Claude Code.

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

*Note: no `.mcpb` release has been published on the releases page yet; until one is, use the Claude Code route.*

**Claude Desktop (recommended):** install [Claude Desktop](https://claude.ai/download), download `reis-for-claude.mcpb` from the latest `mcp-v*` [release](https://github.com/reis-mendelu/reis-extension/releases), double-click it (or drag it into Claude Desktop), enter your IS username and password, then ask "what exams do I have left?".

**Claude Code:** with Node.js 20+ installed, run `/plugin marketplace add reis-mendelu/reis-for-claude`, then `/plugin install reis@reis`, and enter your IS login when asked.

Updates are manual for the `.mcpb` (download and open the new file); the plugin takes two steps: `/plugin marketplace update reis` refreshes the listing, then `claude plugin update reis@reis` (in a terminal) updates the plugin itself; restart Claude Code afterwards. Two-factor IS accounts are not supported yet.
