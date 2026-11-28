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
 * A table that fits the phone is left alone. One that does not gets the first
 * treatment that matches (decided with mock-ups on real pages, 2026-11-28):
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
 * 4. **A one-row layout table** (`reis-flow`): IS's filter forms. Cells wrap.
 * 5. **Anything else** (`reis-compact`): tighter cells, then shrunk by up to
 *    20 % if that makes it fit (`reis-fit`); otherwise it scrolls sideways
 *    inside its own box, as every wide table did before.
 */
export const PHONE_TABLES_JS = String.raw`
function reisTables(d){
var ALL=['reis-exam','reis-att','reis-cards','reis-flow','reis-compact','reis-fit'];
var KEYS=[['por',/^(Poř|Ord)/],['stav',/^(Stav|Status)/],['kod',/^(Kód|Code)/],['predmet',/^(Předmět|Course)/],
['obdobi',/^(Období|Study period)/],['datum',/^(Datum|Date)/],['kde',/^(Kde|Where)/],['druh',/^(Druh|Type \()/],
['vypsal',/^(Vypsal|Put up)/],['prihl',/^(Přihlášeno|Registered)/],['typ',/^(Typ |Type of)/],
['okno',/^(Přihlašování od|Registration from)/],['oper',/^(Operace|Info|Actions)/],['akce',/^(Přihlásit|Odhlásit|Register|Log out)$/]];
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
if(k<1&&k>=0.8){add(t,'reis-fit');t.style.zoom=String(Math.floor(k*100)/100);}
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
function one(t){
ALL.forEach(function(n){if(t.classList.contains(n))t.classList.remove(n);});if(t.style.zoom)t.style.zoom='';
if(!wide(t))return;
var rows=arr(t.rows);
if(rows.length<2){if(rows.length===1&&!arr(rows[0].cells).some(function(c){return c.tagName==='TH';}))add(t,'reis-flow');return;}
if(t.querySelector('table')){squeeze(t);return;}
var head=arr(rows[0].cells),labels=head.map(lab);
var grouped=head.some(function(c){return span(c,'colspan')>1;});
if(grouped){if(rows.length>2&&attendance(t,rows,head))return;squeeze(t);return;}
var body=rows.slice(1),fit=body.filter(function(r){return r.cells.length===head.length;});
var th=head.length>1&&head.every(function(c){return c.tagName==='TH';});
if(!th||!fit.length||fit.length<body.length/2){squeeze(t);return;}
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
var list=arr(d.querySelectorAll('.mainpage table:not(.portal_menu)'));
for(var n=list.length-1;n>=0;n--){try{one(list[n]);}catch(e){}}
}`;
