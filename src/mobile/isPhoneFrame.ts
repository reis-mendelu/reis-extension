import { IS_PHONE_FRAME_CSS } from './isPhoneFrameCss';

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
 * it only ever ADDS two elements to `<head>`:
 *
 * - **Only is.mendelu.cz**, and only the top page, never a frame inside it.
 * - **Only a phone**: the shorter screen side under 768. An iPad's is 810, so
 *   a tablet keeps IS's desktop layout, which fits it.
 * - **Only the frame we know** (`#header`, and `.mainpage` inside `#stranka`).
 *   Any other page, and every page after IS renames these, looks exactly as it
 *   does today. That is the safety net: there is no "original view" switch.
 * - **Not when IS sets a viewport itself**: that is IS going responsive on its
 *   own, and its design wins.
 *
 * The page does not exist yet when this runs, so it waits for the frame to be
 * parsed and gives up at DOMContentLoaded.
 */
const IS_HOST = 'is.mendelu.cz';
/** Tailwind's `md`, the same line the app draws between phone and tablet. */
const TABLET_MIN_SIDE = 768;
export const PHONE_FRAME_STYLE_ID = 'reis-phone-frame';

export function buildPhoneFrameScript(): string {
  // JSON.stringify, not a template literal: the stylesheet is embedded as data,
  // so no quote or backslash in it can end the string and run as code.
  const css = JSON.stringify(IS_PHONE_FRAME_CSS);
  return `(function(){try{
if(window.top!==window)return;
if(location.hostname!==${JSON.stringify(IS_HOST)})return;
if(Math.min(screen.width,screen.height)>=${TABLET_MIN_SIDE})return;
var d=document,done=false,obs=null;
function stop(){done=true;if(obs){obs.disconnect();obs=null;}}
function apply(){
if(done)return;
if(d.getElementById(${JSON.stringify(PHONE_FRAME_STYLE_ID)})||d.querySelector('meta[name="viewport"]')){stop();return;}
if(!d.head||!d.getElementById('header')||!d.querySelector('#stranka > .mainpage'))return;
stop();
var m=d.createElement('meta');m.name='viewport';m.content='width=device-width, initial-scale=1';
var s=d.createElement('style');s.id=${JSON.stringify(PHONE_FRAME_STYLE_ID)};s.textContent=${css};
d.head.appendChild(m);d.head.appendChild(s);
}
apply();
if(done)return;
obs=new MutationObserver(apply);
obs.observe(d,{childList:true,subtree:true});
d.addEventListener('DOMContentLoaded',function(){apply();stop();});
}catch(e){}})();`;
}
