import { IS_PHONE_FRAME_CSS_TABLES } from './isPhoneFrameCssTables';

/**
 * The stylesheet reIS adds to an old IS page on a phone (see isPhoneFrame.ts).
 *
 * The one place IS pages are styled, and a standing exception to "no custom
 * CSS" (CLAUDE.md, Iron Rules): this is not app chrome, it is someone else's
 * page, and DaisyUI does not exist there.
 *
 * What it may do was decided on 2026-11-27 and is pinned in
 * `__tests__/isPhoneFrame.test.ts`:
 *
 * - **The frame, plus two pages** (2026-11-28): header, breadcrumb, the content
 *   column, text and form size, tab rows and tables are styled the same on
 *   every page. Exam terms and List záznamníku get a layout of their own,
 *   because a generic one could not show a term with its register control or a
 *   week with its attendance mark. Anything else students open often belongs in
 *   reIS as a real screen, not here.
 * - **Nothing is moved or removed in the markup, and nothing is loaded.** The
 *   script (isPhoneTablesScript.ts) adds classes and labels; this file does the
 *   rest. What it hides is only what a card layout replaces: the header row of
 *   a table shown as cards, cells with nothing in them, and on exam rows the
 *   row number, subject code and period. The only text it generates is a
 *   column's own header in front of its value.
 * - **The side column is drawn after the content**, not before it (`order`
 *   on `#stranka`'s children). In the markup it still comes first; only the
 *   visual order changes. On a desktop it sits beside the content; stacked in
 *   one column it would otherwise push every page's content half a screen down.
 * - **A table that fits is left alone**, unless it fits only by squeezing every
 *   cell to a word or two (isPhoneTablesScript.ts). One that does not becomes cards, exam
 *   rows or attendance strips, or is tightened and shrunk by up to 8 %; only
 *   what is left after that scrolls sideways inside its own box.
 *
 * Selectors are IS's own ids and classes as dumped from live IS (new design,
 * live since 2026-11-15). `!important` is here because IS sets several of these
 * in `style=""` attributes (the side column is `float: left; width: 250px`).
 */
export const IS_PHONE_FRAME_CSS = `
html { -webkit-text-size-adjust: 100%; }
body { font-size: 16px; line-height: 1.45; }

#header { flex-wrap: wrap; height: auto !important; min-height: 0 !important; padding: 8px 12px; gap: 8px; }
#header .left { flex: 1 1 0; min-width: 124px; align-items: center; gap: 8px; font-size: 14px; line-height: 1.2; }
#header .right { flex: 0 0 auto; margin-left: auto; align-items: center; gap: 6px; font-size: 12px; }
#uis-logo { height: 30px !important; width: auto !important; flex: 0 0 auto; }
#pfp, #pfp img { width: 36px !important; height: 36px !important; }

.wholepage > nav { flex-wrap: wrap; height: auto !important; padding: 8px 12px; row-gap: 6px; }
.breadcrumb { flex-wrap: wrap; min-width: 0; row-gap: 4px; overflow-wrap: anywhere; }

#stranka { display: flex !important; flex-direction: column; padding: 4px 0 32px; }
#stranka > .mainpage { order: 1; min-width: 0; max-width: 100%; }
#stranka > div:not(.mainpage) { order: 2; padding: 0 15px; }
#stranka .portletbar { float: none !important; width: auto !important; padding-right: 0 !important; margin-top: 16px; }

.mainpage div, .mainpage p, .mainpage form { max-width: 100% !important; box-sizing: border-box; }
.mainpage div.small { width: auto !important; }
.mainpage .rada-ikon[data-dir="bottom"] { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)) !important; width: calc(100vw - 42px); box-sizing: border-box; gap: 4px; }
.mainpage .rada-ikon[data-dir="bottom"] .app-ikona { width: auto !important; min-width: 0; }
.mainpage .paginator { flex-wrap: wrap; row-gap: 4px; }
/* Boxes the script measured as wider than their room (isPhoneTablesScript.ts): rows wrap with
   their items at their own size (a title IS keeps on one line must not shrink under the buttons
   beside it), grids become one column, a picture drawn too wide scrolls in its own box. Long text that IS glued
   together with non-breaking spaces breaks only where it would run off the screen
   (break-word, unlike anywhere, leaves tables' own widths as they are). */
.mainpage { overflow-wrap: break-word; }
/* ...except in a box IS sizes to zero width on purpose: its label is meant to overflow (the
   "Dnes" marker on Mapa mých studií broke one letter per line). */
.mainpage .reis-zero { overflow-wrap: normal; }
.mainpage .reis-wrap { flex-wrap: wrap !important; max-width: 100% !important; width: auto !important; }
.mainpage .reis-wrap > * { max-width: 100% !important; box-sizing: border-box; }
.mainpage .reis-stack { grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: none !important; grid-auto-flow: row !important; max-width: 100% !important; width: auto !important; }
.mainpage .reis-stack > * { grid-area: auto !important; min-width: 0; max-width: 100% !important; box-sizing: border-box; }
/* An IS icon draws inside a fixed box (an absolutely placed svg); a flex row that shrinks the
   box lets the drawing spill onto the text beside it (IS's info boxes at 320 px). */
.mainpage .uf-icon { flex-shrink: 0; }
/* Text laid out for one line with a line height smaller than itself (the script's reis-lh). */
.mainpage .reis-lh { line-height: 1.25 !important; }
.mainpage .reis-scroll { overflow-x: auto !important; max-width: 100% !important; -webkit-overflow-scrolling: touch; }
.mainpage .sekce-nadpis { font-size: 14px; }

.mainpage table { display: block; width: auto !important; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.mainpage table:not(.portal_menu) td, .mainpage table:not(.portal_menu) th { font-size: 13px; padding-left: 5px !important; padding-right: 5px !important; }

img, select, textarea, input { max-width: 100%; }
input, select, textarea, button { font-size: 16px; }

@supports (animation-timeline: scroll()) {
  .mainpage table, .mainpage .reis-scroll { animation: reis-more-columns linear both; animation-timeline: scroll(self inline); }
  @keyframes reis-more-columns {
    0%, 96% { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); }
    100% { -webkit-mask-image: linear-gradient(to right, #000 100%, transparent); mask-image: linear-gradient(to right, #000 100%, transparent); }
  }
}
/* IS's tab rows as chips: every button kept, one tinted block per level, the current one solid. */
.mainpage table.portal_menu { display: block !important; overflow: visible !important; animation: none !important; -webkit-mask-image: none !important; mask-image: none !important; width: auto !important; box-sizing: border-box; background: #f1f4ef; border: 0 !important; border-radius: 12px; padding: 8px; margin: 0 0 8px; }
.mainpage table.portal_menu tbody, .mainpage table.portal_menu tr { display: flex !important; flex-wrap: wrap; gap: 6px; }
.mainpage table.portal_menu td { display: block !important; position: static !important; padding: 0 !important; margin: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; height: auto !important; min-height: 0 !important; }
.mainpage table.portal_menu td::before, .mainpage table.portal_menu td::after, .mainpage table.portal_menu tr::before, .mainpage table.portal_menu tr::after { content: none !important; }
.mainpage table.portal_menu td b { display: block; margin: 0 !important; padding: 0 !important; }
.mainpage table.portal_menu td a { display: block; margin: 0 !important; padding: 6px 11px; border: 1px solid #d5dbd0; border-radius: 999px; background: #fff; font-size: 13px !important; font-weight: 400; line-height: 1.2; text-decoration: none; white-space: nowrap; }
.mainpage table.portal_menu td b a { background: #8cbf4a; border-color: #8cbf4a; color: #111; font-weight: 700; }

/* Tables the script has re-read (isPhoneTablesScript.ts) stop being scroll boxes. Every rule for a
   tagged row or cell names the table class too: a table that fits again after the phone is turned
   loses that class but its rows keep theirs. The cell rules after this one have the same weight
   on purpose ("table.x tr > td.y"), so the later rule wins. */
.mainpage table.reis-cards, .mainpage table.reis-exam, .mainpage table.reis-att, .mainpage table.reis-flow, .mainpage table.reis-fit { display: block !important; overflow: visible !important; animation: none !important; -webkit-mask-image: none !important; mask-image: none !important; width: auto !important; }
.mainpage table.reis-cards tbody, .mainpage table.reis-exam tbody, .mainpage table.reis-att tbody { display: block !important; }
.mainpage table.reis-cards tr.reis-head, .mainpage table.reis-exam tr.reis-head, .mainpage table.reis-att tr.reis-head { display: none !important; }
.mainpage table.reis-cards tr.reis-plain, .mainpage table.reis-cards tr.reis-plain > td, .mainpage table.reis-exam tr.reis-plain, .mainpage table.reis-exam tr.reis-plain > td, .mainpage table.reis-att tr.reis-plain, .mainpage table.reis-att tr.reis-plain > td { display: block !important; white-space: normal !important; overflow-wrap: anywhere; }
.mainpage table.reis-cards tr.reis-card, .mainpage table.reis-exam tr.reis-card, .mainpage table.reis-att tr.a-main, .mainpage table.reis-att tr.a-cont { border: 1px solid #d5dbd0; border-radius: 12px; background: #fff !important; padding: 9px 12px; margin: 0 0 10px; }
.mainpage table.reis-cards tr.reis-card > td, .mainpage table.reis-exam tr.reis-card > td, .mainpage table.reis-att tr.a-main > td, .mainpage table.reis-att tr.a-cont > td { border: 0 !important; background: none !important; padding: 0 !important; min-width: 0; width: auto !important; height: auto !important; text-align: left !important; white-space: normal !important; overflow-wrap: anywhere; font-size: 13px !important; }

/* Cards: the name as a title, every other value as a small "header value" fact. */
.mainpage table.reis-cards tr.reis-card { display: flex !important; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
.mainpage table.reis-cards tr.reis-card > td { display: inline-flex !important; flex-wrap: wrap; align-items: baseline; gap: 5px; max-width: 100%; color: #111; }
.mainpage table.reis-cards tr.reis-card > td::before { content: attr(data-label); font-size: 11px; color: #5b6670; white-space: nowrap; }
.mainpage table.reis-cards tr.reis-card > td.reis-icon { align-items: center; }
.mainpage table.reis-cards tr.reis-card > td.reis-title { display: block !important; flex: 0 0 100%; order: -1; font-size: 15px !important; font-weight: 700; }
.mainpage table.reis-cards tr.reis-card > td.reis-title::before { content: none; }
.mainpage table.reis-cards tr.reis-card > td.reis-empty, .mainpage table.reis-cards tr.reis-card > td.reis-dash { display: none !important; }

/* Card rows with a photo (people lists): photo small on the left, the name
   with its icons beside it, the rest below the name. No labels: a name and a
   study need none. The row number is not shown. */
.mainpage table.reis-cards tr.reis-card.reis-person { display: grid !important; grid-template-columns: 44px fit-content(calc(100% - 112px)) minmax(min-content, 1fr); column-gap: 10px; row-gap: 2px; align-items: center; padding: 8px 12px; margin: 0 0 8px; }
.mainpage table.reis-cards tr.reis-card.reis-person > td { display: block !important; grid-column: 2 / span 2; font-size: 12px !important; color: #55606a; line-height: 1.35; }
.mainpage table.reis-cards tr.reis-card.reis-person > td::before { content: none; }
.mainpage table.reis-cards tr.reis-card.reis-person > td.reis-photo { grid-column: 1; grid-row: 1 / span 2; line-height: 0; }
.mainpage table.reis-cards tr.reis-card.reis-person > td.reis-photo img { width: 44px !important; height: 55px !important; object-fit: cover; border-radius: 8px; display: block; float: none !important; margin: 0 !important; }
.mainpage table.reis-cards tr.reis-card.reis-person > td.reis-title { grid-column: 2; grid-row: 1; order: 0; font-size: 15px !important; color: #111; }
.mainpage table.reis-cards tr.reis-card.reis-person > td.reis-icon:not(.reis-photo) { grid-column: 3; grid-row: 1; justify-self: start; line-height: 0; }
.mainpage table.reis-cards tr.reis-card.reis-person > td.reis-num, .mainpage table.reis-cards tr.reis-card.reis-person > td.reis-empty, .mainpage table.reis-cards tr.reis-card.reis-person > td.reis-dash { display: none !important; }

/* Exam terms: status, subject, date and room, then the rest small; register and info on the right. */
.mainpage table.reis-exam tr.reis-card { display: grid !important; grid-template-columns: 16px auto minmax(56px, 1fr) auto; gap: 2px 8px; align-items: center; grid-template-areas: "stav predmet predmet akce" "stav datum kde oper" ". druh vypsal prihl" ". okno okno typ"; }
.mainpage table.reis-exam tr.reis-card > td { display: block !important; font-size: 12px !important; line-height: 1.3; color: #55606a; }
.mainpage table.reis-exam tr > td.x-por, .mainpage table.reis-exam tr > td.x-kod, .mainpage table.reis-exam tr > td.x-obdobi, .mainpage table.reis-exam tr > td.reis-empty { display: none !important; }
.mainpage table.reis-exam tr > td.x-stav { grid-area: stav; align-self: start; padding-top: 4px !important; }
.mainpage table.reis-exam tr > td.x-predmet { grid-area: predmet; font-size: 15px !important; font-weight: 700; color: #111; }
.mainpage table.reis-exam tr > td.x-datum { grid-area: datum; font-size: 14px !important; color: #111; }
.mainpage table.reis-exam tr > td.x-kde { grid-area: kde; font-size: 14px !important; }
.mainpage table.reis-exam tr > td.x-druh { grid-area: druh; }
.mainpage table.reis-exam tr > td.x-vypsal { grid-area: vypsal; }
.mainpage table.reis-exam tr > td.x-prihl { grid-area: prihl; justify-self: end; font-size: 13px !important; color: #111; white-space: nowrap !important; }
.mainpage table.reis-exam tr > td.x-prihl::before { content: attr(data-label) ' '; font-size: 11px; color: #55606a; }
.mainpage table.reis-exam tr > td.x-typ { grid-area: typ; justify-self: end; font-size: 14px !important; transform: scale(0.8); transform-origin: right center; }
.mainpage table.reis-exam tr > td.x-okno { grid-area: okno; display: flex !important; gap: 8px; font-size: 11px !important; }
.mainpage table.reis-exam tr > td.x-okno::before { content: attr(data-label); white-space: pre-line; }
.mainpage table.reis-exam tr > td.x-akce { grid-area: akce; justify-self: end; align-self: start; padding: 4px 0 4px 10px !important; }
.mainpage table.reis-exam tr > td.x-oper { grid-area: oper; justify-self: end; white-space: nowrap !important; font-size: 14px !important; transform: scale(0.8); transform-origin: right center; }

/* List záznamníku: subject with its operation icons, then per time slot a line and twelve week boxes.
   IS gives each attendance cell an inline "padding: 0.5em !important" that no stylesheet can
   override, so a tiny font shrinks it and a flex column keeps the icon centred inside its box. */
.mainpage table.reis-att tr.a-main, .mainpage table.reis-att tr.a-cont { display: grid !important; grid-template-columns: repeat(12, 1fr); gap: 4px 2px; align-items: center; padding: 10px; }
.mainpage table.reis-att tr.a-main:has(+ tr.a-cont), .mainpage table.reis-att tr.a-cont:has(+ tr.a-cont) { border-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; padding-bottom: 4px; }
.mainpage table.reis-att tr.a-cont { border-top: 0; border-top-left-radius: 0; border-top-right-radius: 0; padding-top: 4px; }
.mainpage table.reis-att tr > td { display: block !important; }
.mainpage table.reis-att tr > td.a-pad { display: none !important; }
.mainpage table.reis-att tr > td.a-title { grid-column: 1 / -1; grid-row: 1; align-self: start; min-height: 30px; padding-right: 150px !important; font-size: 15px !important; font-weight: 700; }
.mainpage table.reis-att tr > td.a-op, .mainpage table.reis-att tr > td.a-set { grid-row: 1; justify-self: end; align-self: start; z-index: 1; }
.mainpage table.reis-att tr > td.a-op1 { grid-column: 8; }
.mainpage table.reis-att tr > td.a-op2 { grid-column: 9; }
.mainpage table.reis-att tr > td.a-op3 { grid-column: 10; }
.mainpage table.reis-att tr > td.a-op4 { grid-column: 11; }
.mainpage table.reis-att tr > td.a-set { grid-column: 12; }
.mainpage table.reis-att tr > td.reis-dash { visibility: hidden; }
.mainpage table.reis-att tr > td.a-slot { grid-column: 1 / -1; font-size: 12px !important; color: #55606a; }
.mainpage table.reis-att tr > td.a-week { display: flex !important; flex-direction: column; align-items: center; align-self: stretch; box-sizing: border-box; min-height: 46px; padding: 3px !important; overflow: hidden; border: 1px solid #e1e5df !important; border-radius: 6px; font-size: 6px !important; }
.mainpage table.reis-att tr > td.a-week::before { content: attr(data-label); flex: 0 0 auto; font-size: 9px; line-height: 12px; color: #7a858f; }
.mainpage table.reis-att tr > td.a-week .uf-icon, .mainpage table.reis-att tr > td.a-week img { flex: 0 0 auto; margin: 0 !important; transform: scale(0.72); transform-origin: center top; }

${IS_PHONE_FRAME_CSS_TABLES}
/* A column or row IS itself hides (the row number; "Období" until the student switches it on) stays
   hidden in a card. Last on purpose: it has to win over every display rule above. */
.mainpage table[class*="reis-"] tr[class][style*="display: none"], .mainpage table[class*="reis-"] tr[class][style*="display:none"], .mainpage table[class*="reis-"] tr[class] > td.UISTMNumberCellHidden, .mainpage table[class*="reis-"] tr[class] > td[style*="display: none"], .mainpage table[class*="reis-"] tr[class] > td[style*="display:none"] { display: none !important; }
`;
