/* CageTime Pick'em (front end only).
   - Cards: every upcoming card in events.json (not postponed/cancelled, not finished = 6 h after its first session).
     The card selector follows the sitewide promotion preference (prefs.js, localStorage ct-promos; UFC only by default).
     ?event=<slug> (the "Make your picks" button on event pages) always opens that card, whatever the preference.
   - Locks: the WHOLE card locks at its start time = its earliest listed session (prelims if listed). A card without any
     listed time locks at 00:00 UTC on its date. Locked picks can't be changed (checked again on every click).
   - Scoring against results.json (update_results.py): correct winner = 1 point, + 1 for the right method
     (KO/TKO, Submission, Decision), + 1 for the right round on a finish. Draws / no contests / cancelled bouts are void.
   - "My history": every card picked whose start is at or after the Moicano card (UFC Fight Night: Moicano vs. Nolan,
     first session 2026-10-31T21:00Z); older cards are ignored. Per card: correct/graded (e.g. 7/11) and points; overall
     record W-L, accuracy, current streak (W/L run) and best streak of correct picks, oldest to newest.
     Bouts are matched to results by fighter ids, else by names with accents/punctuation/word order ignored, in either
     corner order (result.winnerId/winnerName are used when present).
   - Storage goes through PickStore (async get/put/all). Today: LocalPickStore (localStorage 'ct-pickem-v1', this browser
     only): {[eventId]: {eventId, name, date, promotion, picks:{[boutKey]:{w:'a'|'b', aName, bName, method?, round?, at}}}}.
     Export/import: a small JSON file or a copyable code (same JSON), merged pick by pick (newest wins).
     A server backend later only needs another object with the same three methods; see PickStore below. */
(function(){
'use strict';
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(_){return '/'}})();
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FIN_MS=6*3600e3;
const HISTORY_FROM=Date.parse('2026-10-31T21:00:00Z');   // first session of UFC Fight Night: Moicano vs. Nolan
const fT=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const fD=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'});
const fS=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'});
const METHODS=['KO/TKO','Submission','Decision'];

/* ---------- storage interface ---------- */
/** PickStore contract (all async):
 *   get(eventId)            -> {eventId, name, date, picks:{[boutKey]:{w:'a'|'b', method?, round?, at}}} | null
 *   put(eventId, record)    -> saved record (a backend must re-check locks server-side)
 *   all()                   -> [record, ...]
 */
const LocalPickStore={
  KEY:'ct-pickem-v1',
  _read(){try{const o=JSON.parse(localStorage.getItem(this.KEY));return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(_){return {}}},
  _write(o){localStorage.setItem(this.KEY,JSON.stringify(o))},
  async get(id){return this._read()[id]||null},
  async put(id,rec){const o=this._read();o[id]=rec;this._write(o);return rec},
  async all(){return Object.values(this._read())}
};
let store=LocalPickStore;
window.CageTimePickem={setStore(s){store=s;boot()},store:()=>store};

/* ---------- helpers ---------- */
const now=()=>Date.now();
function sessions(e){const t=(e.times||[]).filter(x=>x.label&&x.startUTC);if(!t.length&&e.startUTC)t.push({label:'Main card',startUTC:e.startUTC});return t.sort((a,b)=>a.startUTC<b.startUTC?-1:1)}
function firstStart(e){const s=sessions(e);return s.length?new Date(s[0].startUTC).getTime():new Date(e.date+'T23:59:59Z').getTime()}
/* whole card locks at its first listed session; no listed time -> 00:00 UTC on the card's date (never later than the real start) */
function cardLock(e){const s=sessions(e);return s.length?new Date(s[0].startUTC).getTime():new Date(e.date+'T00:00:00Z').getTime()}
const isLocked=e=>now()>=cardLock(e);
const isOff=e=>/postponed|cancel/i.test(e.status||'');
const key=b=>(b.a||b.aName)+'|'+(b.b||b.bName);
const nm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
function methodOf(r){if(!r||r.outcome!=='win')return null;if(/^KO|TKO/.test(r.method||''))return 'KO/TKO';if(/^Sub/.test(r.method||''))return 'Submission';if(/^Dec/.test(r.method||''))return 'Decision';return r.method||null}
/* pick p ('a'/'b' as on the card it was made on) vs result bout b; win = the winning side in the pick's orientation */
function score(p,b,win){
  const r=b&&b.result;if(!p||!p.w)return null;if(!r)return {state:'pending'};
  if(r.outcome!=='win'||!win)return {state:'void',why:r.outcome==='draw'?'Draw':'No contest'};
  const ok=p.w===win,m=methodOf(r);
  let pts=ok?1:0;const mOk=ok&&p.method&&p.method===m,rOk=ok&&mOk&&m!=='Decision'&&p.round&&+p.round===+r.round;
  if(mOk)pts++;if(rOk)pts++;
  return {state:ok?'win':'loss',pts,mOk,rOk};
}
/* find the result bout for a pick: same ids, else same names (accents / punctuation / word order ignored), either corner order */
const same=(id,n,x,xn)=>!!((id&&x&&id===x)||(n&&xn&&nm(n)===nm(xn)));
function sidesOf(k,p){const [ka,kb]=k.split('|');return {ka,kb,an:(p&&p.aName)||(/^tap-/.test(ka)?'':ka),bn:(p&&p.bName)||(/^tap-/.test(kb)?'':kb)}}
function matchBout(k,p,bouts){
  const {ka,kb,an,bn}=sidesOf(k,p);
  for(const rb of bouts||[])if(key(rb)===k)return {rb,flip:false};
  for(const rb of bouts||[]){
    if(same(ka,an,rb.a,rb.aName)&&same(kb,bn,rb.b,rb.bName))return {rb,flip:false};
    if(same(ka,an,rb.b,rb.bName)&&same(kb,bn,rb.a,rb.aName))return {rb,flip:true};
  }
  return null;
}
/* the winning side in the pick's orientation: result.winnerId / winnerName when present, else result.winner (+ flip) */
function winSide(k,p,m){
  const r=m.rb.result;if(!r||r.outcome!=='win')return null;
  if(r.winnerId||r.winnerName){const {ka,kb,an,bn}=sidesOf(k,p);
    if(same(ka,an,r.winnerId,r.winnerName))return 'a';if(same(kb,bn,r.winnerId,r.winnerName))return 'b'}
  if(r.winner!=='a'&&r.winner!=='b')return null;
  return m.flip?(r.winner==='a'?'b':'a'):r.winner;
}
/* grade one pick of a card: {state:'win'|'loss'|'pending'|'void', pts, rb} */
function gradePick(k,p,res){
  if(!res)return {state:'pending'};
  const m=matchBout(k,p,res.bouts);
  if(!m){const c=matchBout(k,p,res.cancelledBouts||[]);return {state:'void',why:c?'Cancelled':'Not on the final card'}}
  return Object.assign(score(p,m.rb,winSide(k,p,m))||{state:'pending'},{rb:m.rb});
}

/* ---------- state ---------- */
let E=null,R=null,cur=null,rec=null,wantId=null;
const resOf=id=>(R.events||[]).find(x=>x.id===id)||null;
const evOf=id=>(E.events||[]).find(x=>x.id===id)||resOf(id);
const allows=p=>!window.CageTimePrefs||window.CageTimePrefs.allows(p);
function openCards(){return E.events.filter(e=>!isOff(e)&&now()<firstStart(e)+FIN_MS).sort((a,b)=>firstStart(a)-firstStart(b))}

/* ---------- render: picks ---------- */
function boutHTML(b,i){
  const locked=isLocked(cur),lk=cardLock(cur);
  const p=(rec.picks||{})[key(b)]||{};
  const res=resOf(cur.id);
  const sc=p.w&&res?gradePick(key(b),p,res):p.w&&locked?{state:'pending'}:null;
  const o=b.odds||{};const side=s=>{const n=s==='a'?b.aName:b.bName,od=o[s];
    return `<button type="button" class="pk-side ${s}" data-i="${i}" data-w="${s}" aria-pressed="${p.w===s}"${locked?' disabled':''}><span class="nm">${esc(n||'TBA')}</span>${od!=null?`<span class="o">${od>0?'+'+od:od}</span>`:''}</button>`};
  const rounds=b.rounds||3;
  return `<article class="pk-bout${locked?' locked':''}" data-key="${esc(key(b))}">
    <div class="bout-head"><span class="wc">${esc(b.weightClass||'—')}${b.rounds?' · '+esc(b.rounds)+' rds':''}</span>${b.title?`<span class="belt">🏆 ${esc(b.title)}</span>`:''}</div>
    <div class="pk-sides" role="group" aria-label="Pick the winner: ${esc(b.aName)} or ${esc(b.bName)}">${side('a')}${side('b')}</div>
    <details class="pk-more"${p.method||p.round?' open':''}><summary>Method &amp; round <small>(optional, bonus points)</small></summary><div class="pk-opts"><label>Method<select data-i="${i}" data-f="method"${locked?' disabled':''}><option value="">Any</option>${METHODS.map(m=>`<option${p.method===m?' selected':''}>${m}</option>`).join('')}</select></label>
      <label>Round<select data-i="${i}" data-f="round"${locked||p.method==='Decision'?' disabled':''}><option value="">Any</option>${Array.from({length:rounds},(_,k)=>`<option${+p.round===k+1?' selected':''}>${k+1}</option>`).join('')}</select></label></div></details>
    ${locked?`<p class="pk-lock is-locked">🔒 Locked at ${esc(fT.format(new Date(lk)))}${!p.w?' · no pick made':''}</p>`:''}
    ${sc?`<p class="pk-score ${sc.state==='win'?'ok':sc.state==='loss'?'bad':'na'}">${sc.state==='pending'?'Result pending':sc.state==='void'?esc(sc.why)+' · pick void':sc.state==='win'?`✓ Correct · ${sc.pts} pt${sc.pts>1?'s':''}${sc.mOk?' (method'+(sc.rOk?' + round':'')+')':''}`:'✗ Wrong pick · 0 pts'}</p>`:''}
  </article>`;
}
function optLabel(e,picked){
  const n=((e.card||{}).bouts||[]).length;
  return `${fS.format(new Date(firstStart(e)))} · ${e.name}${n?'':' (card TBA)'}${isLocked(e)?' · locked':''}${picked?' · ✓ '+picked+'/'+n:''}`;
}
async function renderSelect(){
  const sel=$('#pk-sel');if(!sel)return;
  const all=openCards(),shown=all.filter(e=>allows(e.promotion));
  let extra=null;
  if(cur&&!shown.some(e=>e.id===cur.id))extra=cur;   /* direct ?event= link to a card outside the preference (or finished) */
  const mine={};(await store.all()).forEach(r=>{mine[r.eventId]=Object.keys(r.picks||{}).length});
  const opts=(extra?[extra]:[]).concat(shown);
  sel.innerHTML=opts.length?opts.map(e=>`<option value="${esc(e.id)}"${cur&&e.id===cur.id?' selected':''}>${esc(optLabel(e,mine[e.id]))}</option>`).join(''):'<option value="">No upcoming cards</option>';
  sel.disabled=!opts.length;
  const hidden=all.length-shown.length,note=$('#pk-pfnote');
  if(note){const h=window.CageTimePrefs?window.CageTimePrefs.noteHTML(hidden,'cards',shown.length):'';note.innerHTML=h}   /* stays in the layout (min-height) so the card below never jumps */
}
/* default card: a card in progress that you picked (to follow your picks), else the next card still open for picks */
async function pickDefault(){
  const shown=openCards().filter(e=>allows(e.promotion));
  for(const e of shown){if(!isLocked(e))break;const r=await store.get(e.id);if(r&&Object.keys(r.picks||{}).length)return e}
  return shown.find(e=>!isLocked(e)&&((e.card||{}).bouts||[]).length)||shown.find(e=>!isLocked(e))||shown[0]||null;
}
async function choose(e){
  cur=e||null;
  rec=cur?((await store.get(cur.id))||{eventId:cur.id,name:cur.name,date:cur.date,promotion:cur.promotion,picks:{}}):null;
  renderCard();
}
function renderCard(){
  const el=$('#pk-card');el.classList.remove('pk-loading');
  if(!cur){el.innerHTML=`<p class="muted">No upcoming ${window.CageTimePrefs&&window.CageTimePrefs.mode()==='ufc'?'UFC ':''}card in our data right now. Check back after the next weekly update${window.CageTimePrefs&&window.CageTimePrefs.mode()!=='all'?', or <button type="button" class="pf-link" data-pf-set="all">show all promotions</button>':''}.</p>`;return}
  const bouts=(cur.card&&cur.card.bouts)||[];
  const ss=sessions(cur),locked=isLocked(cur),lk=cardLock(cur);
  const made=bouts.filter(b=>(rec.picks||{})[key(b)]).length;
  let html=`<div class="pk-bar"><div><p class="eyebrow pk-promo">${esc(cur.promotion)}</p><h2 class="section-title">${esc(cur.name)}</h2><p class="muted small">${ss.map(s=>esc(s.label)+': '+esc(fT.format(new Date(s.startUTC)))).join(' · ')||'Time TBA'}</p></div>
    <div class="pk-meta"><p class="pk-lockline${locked?' is-locked':''}">${locked?'🔒 Picks locked '+esc(fT.format(new Date(lk))):'Picks lock '+esc(fT.format(new Date(lk)))+(ss.length?' (first fight)':' (start time TBA)')}</p>
    <p class="muted small" id="pk-count" role="status">${made} of ${bouts.length} picked · saved in this browser</p></div></div>`;
  if(!bouts.length)html+='<div class="tba-card">Card TBA</div>';
  let seg=null;bouts.forEach((b,i)=>{if(b.segment!==seg){seg=b.segment;html+=`<h3 class="seg">${esc(seg||'Fight card')}</h3>`}html+=boutHTML(b,i)});
  html+=`<p class="fc-foot"><a href="${esc(ROOT)}events/${encodeURIComponent(cur.id)}/">Event page: times, full card &amp; where to watch →</a></p>`;
  el.innerHTML=html;
}

/* ---------- history ---------- */
async function historyRows(){
  const all=(await store.all()).filter(r=>r&&r.eventId&&Object.keys(r.picks||{}).length);
  const cards=[];
  all.forEach(r=>{
    const ev=evOf(r.eventId)||{id:r.eventId,name:r.name,date:r.date,promotion:r.promotion};
    const start=firstStart(ev);
    if(!(start>=HISTORY_FROM))return;   /* only cards from the Moicano card on */
    const res=resOf(r.eventId);
    const order=res?res.bouts.map(key):(((ev.card||{}).bouts)||[]).map(key);
    const picks=Object.entries(r.picks||{}).filter(([,p])=>p&&p.w).map(([k,p])=>({k,p,g:res?gradePick(k,p,res):{state:'pending'}}));
    /* chronological inside the card: bottom of the card (first fight) to the main event */
    const pos=x=>{const m=res&&x.g.rb?res.bouts.indexOf(x.g.rb):order.indexOf(x.k);return m<0?-1:m};
    picks.sort((x,y)=>pos(y)-pos(x));
    const ended=now()>=start+FIN_MS,started=now()>=cardLock(ev);
    cards.push({r,ev,res,start,picks,ended,started});
  });
  cards.sort((a,b)=>a.start-b.start);
  return cards;
}
function summarize(cards){
  const seq=[];let pts=0;
  cards.forEach(c=>c.picks.forEach(x=>{if(x.g.state==='win'||x.g.state==='loss'){seq.push(x.g.state==='win');pts+=x.g.pts||0}}));
  const w=seq.filter(Boolean).length,l=seq.length-w;
  let st=0,stT=null;for(let i=seq.length-1;i>=0;i--){if(stT===null)stT=seq[i];if(seq[i]!==stT)break;st++}
  let best=0,run=0;seq.forEach(ok=>{run=ok?run+1:0;if(run>best)best=run});
  return {w,l,n:seq.length,pts,st,stT,best};
}
function cardLine(c,i){
  const g=c.picks.map(x=>x.g),win=g.filter(x=>x.state==='win').length,graded=g.filter(x=>x.state==='win'||x.state==='loss').length,
    pend=g.filter(x=>x.state==='pending').length,vd=g.filter(x=>x.state==='void').length,pts=g.reduce((a,x)=>a+(x.pts||0),0);
  const ev=c.ev,link=c.res?`${ROOT}results/${encodeURIComponent(ev.id)}/`:`${ROOT}events/${encodeURIComponent(ev.id)}/`;
  let status,score='';
  if(!c.started){status=`<span class="pk-st open">Picks open · locks ${esc(fT.format(new Date(cardLock(ev))))}</span>`}
  else if(!c.res&&!c.ended){status='<span class="pk-st live">In progress · results after the event</span>'}
  else if(!c.res){status='<span class="pk-st na">Results pending</span>'}
  else{score=`<b class="pk-cs">${win}/${graded}</b>`;status=`<span class="pk-st">${pts} pt${pts===1?'':'s'}${pend?` · ${pend} pending`:''}${vd?` · ${vd} no contest`:''}</span>`}
  const rows=c.picks.map(x=>{
    const [ka,kb]=x.k.split('|');const b=x.g.rb||(((ev.card||{}).bouts)||[]).find(y=>key(y)===x.k)||{};
    const an=x.p.aName||b.aName||ka,bn=x.p.bName||b.bName||kb;
    const pickN=x.p.w==='a'?an:bn,opp=x.p.w==='a'?bn:an;
    const s=x.g.state,lab=s==='win'?'✓ Correct':s==='loss'?'✗ Wrong':s==='void'?(x.g.why||'No contest')+' · doesn\'t count':'Pending';
    return `<li class="pk-hr ${s}"><span class="pk-hp"><b>${esc(pickN)}</b> <small>over ${esc(opp)}${x.p.method?' · '+esc(x.p.method)+(x.p.round?' R'+esc(x.p.round):''):''}</small></span><span class="pk-hs">${esc(lab)}${s==='win'&&x.g.pts>1?' · '+x.g.pts+' pts':''}</span></li>`;
  }).join('');
  return `<li class="pk-hc"><details${i===0?' open':''}><summary><span class="pk-hn"><b>${esc(ev.name||c.r.name)}</b><small>${esc(ev.promotion||'')}${ev.promotion?' · ':''}${esc(fD.format(new Date(c.start)))} · ${c.picks.length} pick${c.picks.length===1?'':'s'}</small></span><span class="pk-hsum">${score}${status}</span></summary>
    <ul class="pk-hl">${rows}</ul><p class="small"><a href="${esc(link)}">${c.res?'Full results':'Event page'} →</a></p></details></li>`;
}
async function renderStats(){
  const cards=await historyRows(),s=summarize(cards);
  $('#pk-stats').innerHTML=`<div class="pk-stats"><div><b>${s.w}-${s.l}</b><small>Record</small></div><div><b>${s.n?Math.round(100*s.w/s.n)+'%':'—'}</b><small>Accuracy</small></div><div><b>${s.st?(s.stT?'W':'L')+s.st:'—'}</b><small>Streak</small></div><div><b>${s.best||'—'}</b><small>Best streak</small></div></div>`;
  $('#pk-past').innerHTML=`<h2 class="section-title">My history <small>${cards.length} card${cards.length===1?'':'s'}</small></h2>`+(cards.length?
    `<p class="muted small">Every card you picked since UFC Fight Night: Moicano vs. Nolan (Oct 31, 2026). ${s.pts} point${s.pts===1?'':'s'} in total: 1 per correct winner, +1 for the method, +1 for the round of a finish. Draws, no contests and cancelled bouts don't count.</p><ul class="pk-hist">${cards.slice().reverse().map((c,i)=>cardLine(c,i)).join('')}</ul>`:
    `<p class="muted">No picks yet. Cards you pick from UFC Fight Night: Moicano vs. Nolan (Oct 31, 2026) on show up here, graded once results are in.</p>`);
}

/* ---------- export / import ---------- */
function exportObj(list){const cards={};list.forEach(r=>{if(r&&r.eventId&&Object.keys(r.picks||{}).length)cards[r.eventId]=r});return {app:'cagetime-pickem',v:1,exported:new Date().toISOString(),cards}}
const ID_RE=/^[a-z0-9][a-z0-9-]{0,120}$/;
function cleanPick(p){
  if(!p||typeof p!=='object'||(p.w!=='a'&&p.w!=='b'))return null;
  const o={w:p.w};
  if(typeof p.aName==='string')o.aName=p.aName.slice(0,80);if(typeof p.bName==='string')o.bName=p.bName.slice(0,80);
  if(METHODS.includes(p.method))o.method=p.method;
  if(o.method!=='Decision'&&/^[1-5]$/.test(String(p.round||'')))o.round=String(p.round);
  const t=Date.parse(p.at);o.at=isNaN(t)?null:new Date(t).toISOString();
  return o;
}
function parseImport(text){
  text=String(text||'').trim();
  let d;try{d=JSON.parse(text)}catch(_){throw new Error('That is not a CageTime picks file or code.')}
  const cards=d&&d.app==='cagetime-pickem'&&d.cards&&typeof d.cards==='object'?d.cards:null;
  if(!cards)throw new Error('That is not a CageTime picks file or code.');
  return cards;
}
async function importCards(cards){
  let added=0,skipped=0;
  for(const [id,r] of Object.entries(cards)){
    if(!ID_RE.test(id)||!r||typeof r.picks!=='object'){skipped++;continue}
    const ev=evOf(id),lock=ev?cardLock(ev):null;
    const mine=(await store.get(id))||{eventId:id,name:String((ev&&ev.name)||r.name||id).slice(0,160),date:(ev&&ev.date)||(/^\d{4}-\d\d-\d\d$/.test(r.date)?r.date:''),promotion:(ev&&ev.promotion)||r.promotion,picks:{}};
    mine.picks=mine.picks||{};let ch=false;
    for(const [k,p0] of Object.entries(r.picks)){
      const p=cleanPick(p0);if(!p||k.length>200||k.indexOf('|')<0){skipped++;continue}
      if(lock!=null&&(!p.at||Date.parse(p.at)>=lock)){skipped++;continue}   /* a pick made after the card locked is not accepted */
      const old=mine.picks[k];
      if(!old||!old.at||(p.at&&Date.parse(p.at)>Date.parse(old.at))){mine.picks[k]=p;added++;ch=true}
    }
    if(ch)await store.put(id,mine);
  }
  return {added,skipped};
}
function msg(t,bad){const m=$('#pk-io-msg');if(m){m.textContent=t;m.classList.toggle('bad',!!bad)}}
async function afterImport(cards){
  try{const r=await importCards(cards);msg(`Imported ${r.added} pick${r.added===1?'':'s'}${r.skipped?` (${r.skipped} skipped: invalid, or made after that card locked)`:''}.`);await choose(cur);await renderSelect();await renderStats()}
  catch(err){msg(err.message||'Import failed.',true)}
}
document.addEventListener('click',async e=>{
  const t=e.target.closest&&e.target.closest('#pk-export,#pk-copy,#pk-import-code');if(!t)return;
  if(t.id==='pk-export'){
    const o=exportObj(await store.all()),n=Object.keys(o.cards).length;
    if(!n){msg('No picks to export yet.',true);return}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));
    a.download='cagetime-picks-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    msg(`Downloaded ${n} card${n===1?'':'s'} of picks.`);
  }else if(t.id==='pk-copy'){
    const o=exportObj(await store.all()),ta=$('#pk-code');ta.value=JSON.stringify(o);ta.select();
    try{await navigator.clipboard.writeText(ta.value);msg('Code copied. Paste it here on your other device.')}catch(_){msg('Code selected below: copy it, then paste it on your other device.')}
  }else{
    try{await afterImport(parseImport($('#pk-code').value))}catch(err){msg(err.message,true)}
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id!=='pk-file')return;const f=e.target.files&&e.target.files[0];if(!f)return;
  if(f.size>500000){msg('That file is too big to be a picks file.',true);return}
  try{await afterImport(parseImport(await f.text()))}catch(err){msg(err.message,true)}
  e.target.value='';
});

/* ---------- tabs ---------- */
function showTab(name,focus){
  ['picks','history'].forEach(n=>{const t=$('#tab-'+n),p=$('#pk-'+n);if(!t||!p)return;const on=n===name;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;p.hidden=!on;if(on&&focus)t.focus()});
  if(name==='history'&&location.hash!=='#history')history.replaceState(null,'',location.pathname+location.search+'#history');
  if(name==='picks'&&location.hash==='#history')history.replaceState(null,'',location.pathname+location.search);
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('.pk-tabs [role=tab]');if(t){showTab(t.id.slice(4));return}
  const h=e.target.closest&&e.target.closest('[data-tab-link]');if(h){e.preventDefault();showTab('history',true);return}
  const m=e.target.closest&&e.target.closest('[data-move-link]');if(m){e.preventDefault();const d=$('#pk-move');d.open=true;d.querySelector('summary').focus();d.scrollIntoView({block:'nearest'})}
});
window.addEventListener('hashchange',()=>{if(location.hash==='#history')showTab('history')});
document.addEventListener('keydown',e=>{const t=e.target.closest&&e.target.closest('.pk-tabs [role=tab]');if(!t||!/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key))return;e.preventDefault();showTab(t.id==='tab-picks'?'history':'picks',true)});

/* ---------- picking ---------- */
async function save(){rec.savedAt=new Date().toISOString();await store.put(cur.id,rec)}
document.addEventListener('click',async e=>{
  const btn=e.target.closest&&e.target.closest('.pk-side');if(!btn||!cur)return;
  if(isLocked(cur)){renderCard();return}   /* locked since the page was drawn */
  const b=cur.card.bouts[+btn.dataset.i];
  const k=key(b);rec.picks=rec.picks||{};const p=rec.picks[k]||{};
  if(p.w===btn.dataset.w){delete rec.picks[k]}else{rec.picks[k]={...p,w:btn.dataset.w,aName:b.aName,bName:b.bName,at:new Date().toISOString()}}
  await save();renderCard();renderSelect();renderStats();
  const nb=document.querySelector(`.pk-side[data-i="${btn.dataset.i}"][data-w="${btn.dataset.w}"]`);if(nb)nb.focus();
});
document.addEventListener('change',async e=>{
  if(e.target.id==='pk-sel'){const ev=evOf(e.target.value);if(ev){await choose(ev);const u=new URL(location.href);u.searchParams.set('event',ev.id);history.replaceState(null,'',u)}return}
  const s=e.target.closest&&e.target.closest('.pk-opts select');if(!s||!cur)return;
  if(isLocked(cur)){renderCard();return}
  const b=cur.card.bouts[+s.dataset.i];
  const k=key(b);rec.picks=rec.picks||{};const p=rec.picks[k]||{};
  if(!p.w){s.value='';const c=$('#pk-count');if(c)c.textContent='Pick a winner first, then the method or round.';return}
  p[s.dataset.f]=s.value||undefined;if(p.method==='Decision')delete p.round;p.at=new Date().toISOString();rec.picks[k]=p;
  await save();renderCard();
  const ns=document.querySelector(`.pk-opts select[data-i="${s.dataset.i}"][data-f="${s.dataset.f}"]`);if(ns)ns.focus();
});
window.addEventListener('ct-promos',async()=>{if(!E)return;if(!cur||(!allows(cur.promotion)&&cur.id!==wantId))await choose(await pickDefault());renderSelect()});
window.addEventListener('storage',e=>{if(e.key===LocalPickStore.KEY&&E)boot()});
const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()});
async function boot(){
  try{
    if(!E)[E,R]=await Promise.all([getJSON(ROOT+'events.json'),getJSON(ROOT+'results.json').catch(()=>({events:[]}))]);
    const q=new URLSearchParams(location.search).get('event');
    const asked=q&&E.events.find(e=>e.id===q);wantId=asked?q:null;
    await choose(cur?evOf(cur.id)||await pickDefault():asked||await pickDefault());
    await renderSelect();await renderStats();
    if(location.hash==='#history')showTab('history');
  }catch(err){console.error(err);$('#pk-card').innerHTML='<p class="muted">Could not load the card. Please refresh.</p>'}
}
let lockedN=-1;
setInterval(()=>{if(!cur||document.visibilityState!=='visible')return;const n=isLocked(cur)?1:0;
  if(n!==lockedN){lockedN=n;renderCard();renderSelect()}},30000);   /* picks lock live while the page is open */
boot();
})();
