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
 * - **The frame only**: header, breadcrumb, the content column, text and form
 *   size, tables. No page gets rules of its own. A page students open often
 *   belongs in reIS as a real screen, not here.
 * - **Styling only**: nothing is hidden, nothing is generated, nothing is
 *   loaded. Hiding or relabelling an element can break a form IS itself
 *   submits (exam and subject registration live on these pages).
 * - **A wide table keeps its columns** and scrolls sideways inside its own box.
 *   The exam table has 14 columns and List záznamníku 19; a phone shows about
 *   six. Reshaping rows into cards needs script, which the line above rules out.
 *
 * Selectors are IS's own ids and classes as dumped from live IS (new design,
 * live since 2026-11-15). `!important` is here because IS sets several of these
 * in `style=""` attributes (the side column is `float: left; width: 250px`).
 */
export const IS_PHONE_FRAME_CSS = `
html { -webkit-text-size-adjust: 100%; }
body { font-size: 16px; line-height: 1.45; }

#header { flex-wrap: wrap; height: auto !important; min-height: 0 !important; padding: 8px 12px; gap: 8px; }
#header .left { flex: 1 1 0; min-width: 0; align-items: center; gap: 10px; font-size: 15px; line-height: 1.2; }
#header .right { flex: 0 0 auto; align-items: center; gap: 8px; font-size: 13px; }
#uis-logo { height: 34px !important; width: auto !important; }
#pfp, #pfp img { width: 40px !important; height: 40px !important; }

.wholepage > nav { flex-wrap: wrap; height: auto !important; padding: 8px 12px; row-gap: 6px; }
.breadcrumb { flex-wrap: wrap; min-width: 0; row-gap: 4px; }

#stranka { display: flex !important; flex-direction: column; padding: 4px 12px 32px; }
#stranka > .mainpage { order: 1; min-width: 0; max-width: 100%; }
#stranka > div:not(.mainpage) { order: 2; }
#stranka .portletbar { float: none !important; width: auto !important; padding-right: 0 !important; margin-top: 16px; }

.mainpage div, .mainpage p, .mainpage form { max-width: 100% !important; box-sizing: border-box; }
.mainpage div.small { width: auto !important; }

.mainpage table { display: block; width: auto !important; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.mainpage table:not(.portal_menu) td, .mainpage table:not(.portal_menu) th { font-size: 13px; padding-left: 5px !important; padding-right: 5px !important; }

img, select, textarea, input { max-width: 100%; }
input, select, textarea, button { font-size: 16px; }

@supports (animation-timeline: scroll()) {
  .mainpage table { animation: reis-more-columns linear both; animation-timeline: scroll(self inline); }
  @keyframes reis-more-columns {
    0%, 96% { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); }
    100% { -webkit-mask-image: linear-gradient(to right, #000 100%, transparent); mask-image: linear-gradient(to right, #000 100%, transparent); }
  }
}
`;
