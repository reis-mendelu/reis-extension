import { IS_PHONE_FRAME_CSS } from './isPhoneFrameCss';
import { PHONE_TABLES_JS } from './isPhoneTablesScript';

/**
 * Makes an old IS page readable on a phone.
 *
 * IS sends no viewport tag and has no phone rules (its stylesheet adapts only
 * the cookie banner and the PDF reader). A phone therefore lays a signed-in
 * page out 1,400 to 1,800 px wide and shrinks it to about a quarter: body text
 * lands near 3.5 px (measured on the exam page, 2026-11-27). This script tells
 * the page to use the phone's real width and adds one stylesheet for the frame
 * every IS page shares.
 *
 * It runs in the in-app browser the phone opens IS in, at document start on
 * every page, beside the script that restores the session (openExternal.ts).
 * It is a string evaluated inside an authenticated IS page, so it is small and
 * it only ever ADDS: two elements to `<head>`, and classes and labels on IS's
 * tables. Where it does that:
 *
 * - **Only is.mendelu.cz**, and only the top page, never a frame inside it.
 * - **Only a phone**: the shorter screen side under 600. That is where Android
 *   itself starts calling a screen a tablet (sw600dp), and it is below every
 *   iPad (the mini's shorter side is 744, the app's test iPad's 810). A tablet
 *   keeps IS's desktop layout, which fits it.
 * - **Only the frame we know** (`#header`, and `.mainpage` inside `#stranka`).
 *   Any other page, and every page after IS renames these, looks exactly as it
 *   does today. That is the safety net: there is no "original view" switch.
 * - **Not when IS sets a viewport itself**: that is IS going responsive on its
 *   own, and its design wins.
 *
 * The page does not exist yet when this runs, so it waits for the frame to be
 * parsed and gives up at DOMContentLoaded.
 *
 * Once the frame is in, it also looks at IS's tables (isPhoneTablesScript.ts):
 * when the page is parsed, again when it has loaded and each time a web font
 * finishes loading (both change widths; a font can arrive after `load`, and
 * `fonts.ready` read at document start can resolve before any font was even
 * asked for, hence `loadingdone` too), and again when the phone is turned. A resize that leaves the
 * width alone is the keyboard opening, and re-laying tables under someone
 * typing into IS's own form would be worse than doing nothing. Should the
 * script ever run twice on one page, only the run that added the stylesheet
 * keeps handling tables (`document.__reisPhone`).
 */
const IS_HOST = 'is.mendelu.cz';
/** Android's sw600dp. Not Tailwind's `md` (768): an iPad mini is 744 wide. */
const TABLET_MIN_SIDE = 600;
export const PHONE_FRAME_STYLE_ID = 'reis-phone-frame';

export function buildPhoneFrameScript(): string {
  // JSON.stringify, not a template literal: the stylesheet is embedded as data,
  // so no quote or backslash in it can end the string and run as code.
  const css = JSON.stringify(IS_PHONE_FRAME_CSS);
  return `(function(){try{
if(window.top!==window)return;
if(location.hostname!==${JSON.stringify(IS_HOST)})return;
if(Math.min(screen.width,screen.height)>=${TABLET_MIN_SIDE})return;
var d=document,done=false,applied=false,obs=null,lastW=-1,me={};
${PHONE_TABLES_JS}
function stop(){done=true;if(obs){obs.disconnect();obs=null;}}
function apply(){
if(done)return;
if(d.getElementById(${JSON.stringify(PHONE_FRAME_STYLE_ID)})||d.querySelector('meta[name="viewport"]')){stop();return;}
if(!d.head||!d.getElementById('header')||!d.querySelector('#stranka > .mainpage'))return;
stop();applied=true;d.__reisPhone=me;
var m=d.createElement('meta');m.name='viewport';m.content='width=device-width, initial-scale=1';
var s=d.createElement('style');s.id=${JSON.stringify(PHONE_FRAME_STYLE_ID)};s.textContent=${css};
d.head.appendChild(m);d.head.appendChild(s);
}
function tables(turned){
if(!applied||d.__reisPhone!==me)return;
var w=d.documentElement.clientWidth;
if(turned&&w===lastW)return;
lastW=w;reisTables(d);
}
apply();
window.addEventListener('load',function(){tables(false);});
if(d.fonts&&d.fonts.ready&&d.fonts.ready.then)d.fonts.ready.then(function(){tables(false);});
if(d.fonts&&d.fonts.addEventListener)d.fonts.addEventListener('loadingdone',function(){tables(false);});
window.addEventListener('resize',function(){tables(true);});
if(done){if(d.readyState!=='loading')tables(false);else d.addEventListener('DOMContentLoaded',function(){tables(false);});return;}
obs=new MutationObserver(apply);
obs.observe(d,{childList:true,subtree:true});
d.addEventListener('DOMContentLoaded',function(){apply();stop();tables(false);});
}catch(e){}})();`;
}
