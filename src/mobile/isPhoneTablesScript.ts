/**
 * The half of the phone script that deals with IS's tables (isPhoneFrame.ts
 * embeds it). Source text, not a function: it is evaluated inside an IS page,
 * so nothing a bundler adds to a function (tsx's `__name`, for one) may be in
 * it. Plain ES5, because old Android WebViews run it too.
 *
 * It ADDS classes and `data-label` attributes, and one inline `zoom`; when the
 * phone is turned it takes its own table classes and `zoom` back before
 * judging again. It never creates, moves or removes an element: these tables hold IS's own forms and
 * links (exam registration is one), and they must keep working untouched.
 * `__tests__/isPhoneTables.test.ts` pins that.
 *
 * Tables are read innermost first: a layout table is often wide only because
 * of the table inside it, and must be judged after that one has been dealt
 * with. A table that still holds other tables is layout, never data, so it is
 * only ever wrapped (one row) or tightened.
 *
 * A table that fits the phone is left alone, unless it fits only by squeezing:
 * one with a header row whose natural width is at least 1.5x its room (every
 * cell down to a word or two) is treated as not fitting, and can only become
 * cards or exam rows (round three, 2026-11-28; it changes Dominik's "cards for
 * tables that don't fit" and is his to veto). One that does not fit gets the
 * first treatment that matches (decided with mock-ups on real pages, 2026-11-28):
 *
 * 1. **Exam terms** (`reis-exam`): a header with a subject and a date column.
 *    Columns are found by header WORDS, Czech or English, never by position,
 *    so a table IS reorders still works and one it renames falls through.
 * 2. **List záznamníku** (`reis-att`): two header rows, the second holding
 *    numbered weeks. A cell spanning both rows names its own columns; one that
 *    does not hands its columns to the second row. A subject's second time
 *    slot is a short row holding only those handed-over columns.
 * 3. **Cards** (`reis-cards`): a plain `<th>` header whose rows line up with
 *    it. Each cell is labelled with its column's header. A row with a photo
 *    (a big picture and no text: people lists) is `reis-person`, so the photo
 *    sits small on the left; a bare number under an empty header is
 *    `reis-num` (the row number) and is not shown.
 * 4. **Label/value pairs** (`reis-kv`): at least three rows of two cells, the
 *    rest single full-width cells, most first cells a label ending with a
 *    colon (the syllabus's details). Each value goes
 *    under its label. A numbered list ("1.", "a.") is not labels.
 * 5. **A one-row layout table** (`reis-flow`): IS's filter forms. Cells wrap.
 * 6. **Anything else** (`reis-compact`): tighter cells (12 px), then shrunk
 *    by up to 8 % if that makes it fit (`reis-fit`): no further, or the text
 *    drops under 11 px; otherwise it scrolls sideways inside its own box, as
 *    every wide table did before.
 *
 * Then the boxes outside tables, judged the same way (round two of the
 * phone loop, 2026-11-28, from 125 saved pages): a flex row or grid wider
 * than its room wraps: a flex row (IS's column toggles) gets `reis-wrap` and
 * its items move to the next line at their own size, a grid (filters, app
 * logos) gets `reis-stack` and becomes one column; a picture drawn wider than its box (a d3 chart at
 * 1000 px), one that would stick out of the page itself and not merely its
 * own box (IS's tile icons overflow theirs by a few pixels on purpose), makes
 * that box `reis-scroll`. One that fits is left alone. Text
 * whose line height is smaller than the text itself (IS's folder tree: 10 px
 * lines for 13 px text) gets `reis-lh`: it was laid out for one line, and on
 * a phone its second line is drawn over the first.
 */
export const PHONE_TABLES_JS = String.raw`
function reisTables(d){
var ALL=['reis-exam','reis-att','reis-cards','reis-kv','reis-flow','reis-compact','reis-fit'];
var KEYS=[['por',/^(Poř|Ord)/],['stav',/^(Stav|Status)/],['kod',/^(Kód|Code)/],['predmet',/^(Předmět|Course)/],
['obdobi',/^(Období|Study period)/],['datum',/^(Datum|Date)/],['kde',/^(Kde|Where)/],['druh',/^(Druh|Type \()/],
['vypsal',/^(Vypsal|Put up)/],['prihl',/^(Přihlášeno|Registered)/],['typ',/^(Typ |Type of)/],
['okno',/^(Přihlašování od|Registration from)/],['oper',/^(Operace|Info|Actions)/],['akce',/^(Přihlásit|Odhlásit|Register|Log out)$/]];
var CTL='input,select,textarea,button';
var TITLE=/^(Předmět|Název|Jméno|Příspěvky|Studium|Instituce|Course|Name|Title)/,WEEK=/^\d+\.$/,NUM=/^\d+\.?$/,DASH=/^[-–—]+$/;
function txt(el){return (el.textContent||'').replace(/\s+/g,' ').trim();}
function lab(el){var s='';(function walk(n){for(var c=n.firstChild;c;c=c.nextSibling){if(c.nodeType===3)s+=c.data;else if(c.nodeName==='BR')s+='\n';else walk(c);}})(el);return s.replace(/[^\S\n]+/g,' ').replace(/ ?\n ?/g,'\n').trim();}
function span(c,a){return parseInt(c.getAttribute(a)||'1',10)||1;}
function arr(x){return [].slice.call(x);}
function add(el,names){names.split(' ').forEach(function(n){el.classList.add(n);});}
function pic(c){return !!c.querySelector('img,svg,.uf-icon');}
function wide(t){return t.scrollWidth>t.clientWidth+1;}
function photo(c){var m=c.querySelector('img');if(!m||txt(c)||c.querySelector('.uf-icon'))return false;return (parseInt(m.getAttribute('height')||'0',10)||m.height||0)>=48;}
function mark(c,label){
c.setAttribute('data-label',label);
var s=txt(c);
if(!s&&pic(c))add(c,'reis-icon');
else if(!s&&!c.querySelector('a,input,select,button,textarea'))add(c,'reis-empty');
else if(DASH.test(s)&&!pic(c)&&!c.querySelector('a'))add(c,'reis-dash');
}
function squeeze(t){
add(t,'reis-compact');
var k=t.clientWidth/t.scrollWidth;
if(k<1&&k>=0.92){add(t,'reis-fit');t.style.zoom=String(Math.floor(k*100)/100);}
}
function attendance(t,rows,head){
var sub=arr(rows[1].cells),at=0,full=[],weeks=0;
head.forEach(function(c){
var n=span(c,'colspan'),both=span(c,'rowspan')>1,i,l;
for(i=0;i<n;i++){
if(both)full.push({k:n>1?'a-op a-op'+(i+1):'solo',l:lab(c),s:false});
else{l=sub[at]?lab(sub[at]):'';at++;if(WEEK.test(l))weeks++;full.push({k:WEEK.test(l)?'a-week':l?'a-slot':'a-pad',l:l,s:true});}
}
});
if(at!==sub.length||weeks<6)return false;
var solos=full.filter(function(f){return f.k==='solo';});
solos.forEach(function(f,i){f.k=i===0?'a-title':'a-set';});
var part=full.filter(function(f){return f.s;});
rows.forEach(function(r,n){
if(n<2){add(r,'reis-head');return;}
var map=r.cells.length===full.length?full:r.cells.length===part.length?part:null;
if(!map){add(r,'reis-plain');return;}
add(r,map===full?'a-main':'a-cont');
arr(r.cells).forEach(function(c,i){add(c,map[i].k);mark(c,map[i].l);});
});
add(t,'reis-att');return true;
}
function own(r){return arr(r.children).filter(function(c){return c.tagName==='TD'||c.tagName==='TH';});}
function pairs(t,rows){
rows=rows.filter(function(r){for(var p=r.parentElement;p;p=p.parentElement)if(p.tagName==='TABLE')return p===t;return false;});
var two=rows.filter(function(r){return own(r).length===2;});
if(two.length<3||rows.some(function(r){return own(r).length>2;}))return false;
var lab=two.filter(function(r){var x=txt(own(r)[0]);return x.length<=40&&/:$/.test(x);});
if(lab.length<two.length/2)return false;
rows.forEach(function(r){if(own(r).length===2){add(r,'kv-pair');add(own(r)[0],'kv-label');}else add(r,'reis-plain');});
add(t,'reis-kv');return true;
}
function natural(t){var had=t.hasAttribute('class');add(t,'reis-measure');var w=t.scrollWidth;t.classList.remove('reis-measure');if(!had&&!t.className)t.removeAttribute('class');return w;}
function one(t){
ALL.forEach(function(n){if(t.classList.contains(n))t.classList.remove(n);});if(t.style.zoom)t.style.zoom='';
var rows=arr(t.rows),soft=!wide(t);
if(soft){
if(rows.length<2||t.querySelector('table'))return;
var top=arr(rows[0].cells);
if(top.length<3||!top.every(function(c){return c.tagName==='TH';})||natural(t)<=t.clientWidth*1.5)return;
}
if(rows.length<2){
if(rows.length===1&&!arr(rows[0].cells).some(function(c){return c.tagName==='TH';})){
add(t,'reis-flow');
arr(rows[0].cells).forEach(function(c,i,a){var nx=a[i+1];if(nx&&txt(c)&&!c.querySelector(CTL)&&nx.querySelector(CTL))add(c,'reis-lab');});
}
return;
}
if(!soft&&pairs(t,rows))return;
if(t.querySelector('table')){squeeze(t);return;}
var head=arr(rows[0].cells),labels=head.map(lab);
var grouped=head.some(function(c){return span(c,'colspan')>1;});
if(grouped){if(soft)return;if(rows.length>2&&attendance(t,rows,head))return;squeeze(t);return;}
var body=rows.slice(1),fit=body.filter(function(r){return r.cells.length===head.length;});
var th=head.length>1&&head.every(function(c){return c.tagName==='TH';});
if(th&&body.length&&body.every(function(r){return r.cells.length===1&&span(r.cells[0],'colspan')>1;})){
add(rows[0],'reis-head');body.forEach(function(r){add(r,'reis-plain');});add(t,'reis-cards');return;
}
if(!th||!fit.length||fit.length<body.length/2){if(!soft)squeeze(t);return;}
var keys=labels.map(function(x){for(var i=0;i<KEYS.length;i++)if(KEYS[i][1].test(x))return KEYS[i][0];return '';});
var isExam=keys.indexOf('predmet')>=0&&keys.indexOf('datum')>=0;
var title=-1;
if(!isExam)labels.forEach(function(x,i){if(title<0&&TITLE.test(x)&&fit.some(function(r){return txt(r.cells[i]).length>2;}))title=i;});
add(rows[0],'reis-head');
body.forEach(function(r){
if(fit.indexOf(r)<0){add(r,'reis-plain');return;}
add(r,'reis-card');
arr(r.cells).forEach(function(c,i){mark(c,labels[i]);if(isExam&&keys[i])add(c,'x-'+keys[i]);if(i===title)add(c,'reis-title');
if(isExam)return;if(photo(c)){add(c,'reis-photo');add(r,'reis-person');}else if(!labels[i]&&NUM.test(txt(c)))add(c,'reis-num');});
});
add(t,isExam?'reis-exam':'reis-cards');
}
function ownText(e){for(var c=e.firstChild;c;c=c.nextSibling)if(c.nodeType===3&&/\S/.test(c.data))return true;return false;}
function inTable(e){for(var p=e.parentElement;p;p=p.parentElement){if(p.tagName==='TABLE')return true;if(p.classList&&p.classList.contains('mainpage'))return false;}return false;}
function tap(tiny){
if(!tiny.length)return;
var others=arr(d.querySelectorAll('.mainpage a, .mainpage button, .mainpage input, .mainpage select, .mainpage textarea'));
tiny.forEach(function(t){
var b=t[1],g=99;
others.forEach(function(o){if(o===t[0]||o.contains(t[0])||t[0].contains(o))return;var rs=o.getClientRects?arr(o.getClientRects()):[];if(!rs.length)rs=[o.getBoundingClientRect()];
rs.forEach(function(r){if(r.width)g=Math.min(g,Math.max(0,r.left-b.right,b.left-r.right,r.top-b.bottom,b.top-r.bottom));});});
var c=g>=24?'reis-tap':g>=16?'reis-tap-8':g>=8?'reis-tap-4':'';if(c)add(t[0],c);
});
}
function boxes(){
var BOX=['reis-wrap','reis-stack','reis-scroll','reis-lh','reis-zero','reis-tap','reis-tap-8','reis-tap-4'];
arr(d.querySelectorAll('.mainpage .'+BOX.join(', .mainpage .'))).forEach(function(e){BOX.forEach(function(k){e.classList.remove(k);});});
var main=d.querySelector('.mainpage'),edge=main?main.getBoundingClientRect():null;
var tiny=[];
arr(d.querySelectorAll('.mainpage *')).forEach(function(e){
var name=e.tagName.toLowerCase();
if(name==='svg'||name==='canvas'){var p=e.parentElement,b=e.getBoundingClientRect();if(p&&edge&&!inTable(e)&&(b.right>edge.right+1||b.left<edge.left-1))add(p,'reis-scroll');return;}
if(e.style&&/^0(px)?$/.test(e.style.width))add(e,'reis-zero');
var cs=getComputedStyle(e);
if(/px$/.test(cs.lineHeight)&&parseFloat(cs.lineHeight)<parseFloat(cs.fontSize)&&ownText(e))add(e,'reis-lh');
if(name==='a'&&!txt(e)){var m=e.querySelector('img,svg');if(m){var b=m.getBoundingClientRect();if(b.width>0&&b.width<24&&b.height<24)tiny.push([e,b]);}}
if(e.tagName==='TABLE'||inTable(e))return;
if(!/flex|grid/.test(cs.display)||cs.overflowX==='auto'||cs.overflowX==='scroll')return;
if(wide(e))add(e,/grid/.test(cs.display)?'reis-stack':'reis-wrap');
});
tap(tiny);
}
var list=arr(d.querySelectorAll('.mainpage table:not(.portal_menu)'));
for(var n=list.length-1;n>=0;n--){try{one(list[n]);}catch(e){}}
// A table judged before the one around it changed shape (a table inside a label/value cell) is judged again if it no longer fits.
for(n=list.length-1;n>=0;n--){try{var u=list[n];if(!ALL.some(function(k){return u.classList.contains(k);})&&wide(u))one(u);}catch(e){}}
try{boxes();}catch(e){}
}`;
