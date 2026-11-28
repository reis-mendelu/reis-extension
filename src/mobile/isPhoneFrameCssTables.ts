/**
 * The later table treatments of the IS phone stylesheet (isPhoneFrameCss.ts
 * puts them in its place, in order): tightened tables, one-row forms,
 * label/value lists, tap areas. Split out only to keep each file short; it is
 * part of the one IS stylesheet the CLAUDE.md exception names.
 */
export const IS_PHONE_FRAME_CSS_TABLES = `
/* What the script could not re-read: tighter cells; a one-row filter form wraps. */
.mainpage table.reis-compact td, .mainpage table.reis-compact th { font-size: 12px !important; padding: 2px 3px !important; white-space: normal !important; width: auto !important; }
/* Tightened tables: IS's no-wrap pieces may wrap, a text field takes its cell's width (a form keeps its layout). */
.mainpage table.reis-compact .nowrap, .mainpage table.reis-compact td span, .mainpage table.reis-compact th span { white-space: normal !important; }
/* ...but a number keeps its digits together ("2 000 000" broke into three lines that read as three numbers). */
.mainpage table.reis-compact td.reis-numeric, .mainpage table.reis-compact td.reis-numeric span { white-space: nowrap !important; }
.mainpage table.reis-compact input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="hidden"]):not(.hasDatepicker), .mainpage table.reis-compact select, .mainpage table.reis-compact textarea { width: 100% !important; min-width: 0 !important; max-width: 100%; box-sizing: border-box; }
.mainpage table.reis-compact input.hasDatepicker { width: calc(100% - 36px) !important; min-width: 0 !important; box-sizing: border-box; }
/* Footnote marks in restyled tables stay readable (the timetable's "(3)" came out at 10 px). */
.mainpage table[class*="reis-"] sup, .mainpage table[class*="reis-"] sub { font-size: max(11px, 0.75em) !important; }
.mainpage table.reis-flow tbody, .mainpage table.reis-flow tr { display: flex !important; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.mainpage table.reis-flow td { display: block !important; padding: 0 !important; max-width: 100%; }
/* Label/value pairs (the syllabus's details): each value under its label, nothing scrolls sideways.
   Only the list's own rows and cells: a table inside a value (the topic list) keeps its own layout. */
.mainpage table.reis-kv { display: block !important; overflow: visible !important; animation: none !important; -webkit-mask-image: none !important; mask-image: none !important; width: auto !important; }
.mainpage table.reis-kv > tbody, .mainpage table.reis-kv > tbody > tr { display: block !important; }
.mainpage table.reis-kv > tbody > tr.kv-pair { margin: 0 0 8px; }
.mainpage table.reis-kv > tbody > tr > td { display: block !important; width: auto !important; padding: 0 !important; white-space: normal !important; overflow-wrap: anywhere; }
.mainpage table.reis-kv > tbody > tr > td.kv-label, .mainpage table.reis-kv > tbody > tr > td.kv-label * { font-size: 12px !important; color: #5b6670; white-space: normal !important; }
.mainpage table.reis-kv .nowrap { white-space: normal !important; }
/* A filter's label starts its own line, so its control sits right under it, never at the start of the next. */
.mainpage table.reis-flow td.reis-lab { flex-basis: 100%; }
/* While the script measures a table's natural width (it never stays). */
.mainpage table.reis-measure { display: table !important; width: max-content !important; max-width: none !important; }
/* A tiny icon-only link (the folder tree's expand/collapse boxes): a bigger tap area, nothing moves.
   The script picks the step that stays within half the gap to the nearest other link or control,
   so a tap on a neighbour still reaches the neighbour. */
.mainpage a.reis-tap { display: inline-block; padding: 12px; margin: -12px; }
.mainpage a.reis-tap-8 { display: inline-block; padding: 8px; margin: -8px; }
.mainpage a.reis-tap-4 { display: inline-block; padding: 4px; margin: -4px; }
.mainpage table.reis-flow select, .mainpage table.reis-flow input { max-width: calc(100vw - 30px); }
`;
