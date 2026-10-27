/* CageTime UFC Pick'em (front end only).
   - Card: the next UFC event in events.json that has not finished (6 h after its first session).
   - Each bout locks at the start of its own segment (Early prelims / Prelims / Main card session time from the event's
     times list; if that segment has no listed time, the earliest listed time). Locked picks can't be changed.
   - Scoring against results.json (update_results.py): correct winner = 1 point, + 1 for the right method
     (KO/TKO, Submission, Decision), + 1 for the right round on a finish. Draws / no contests are void.
     Personal record = correct-winner picks W-L; streak = consecutive correct winners, oldest to newest.
   - Storage goes through PickStore (async get/put/all). Today: LocalPickStore (localStorage, this browser only).
     A server backend later only needs another object with the same three methods; see PickStore below. */
(function(){
'use strict';
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(_){return '/'}})();
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FIN_MS=6*3600e3;
const fT=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const fD=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'});
const METHODS=['KO/TKO','Submission','Decision'];

/* ---------- storage interface ---------- */
/** PickStore contract (all async):
 *   get(eventId)            -> {eventId, name, date, picks:{[boutKey]:{w:'a'|'b', method?, round?, at}}} | null
 *   put(eventId, record)    -> saved record (a backend must re-check locks server-side)
 *   all()                   -> [record, ...]
 */
const LocalPickStore={
  KEY:'ct-pickem-v1',
  _read(){try{return JSON.parse(localStorage.getItem(this.KEY))||{}}catch(_){return {}}},
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
function lockAt(e,b){
  const s=sessions(e);if(!s.length)return null;
  const seg=(b.segment||'').toLowerCase();
  const m=s.find(x=>x.label.toLowerCase()===seg)||s.find(x=>x.label.toLowerCase().startsWith(seg));
  return new Date((m||s[0]).startUTC).getTime();
}
const key=b=>(b.a||b.aName)+'|'+(b.b||b.bName);
function methodOf(r){if(!r||r.outcome!=='win')return null;if(/^KO|TKO/.test(r.method||''))return 'KO/TKO';if(/^Sub/.test(r.method||''))return 'Submission';if(/^Dec/.test(r.method||''))return 'Decision';return r.method||null}
function score(p,b){
  const r=b&&b.result;if(!p||!p.w)return null;if(!r)return {state:'pending'};
  if(r.outcome!=='win'||!r.winner)return {state:'void',why:r.outcome==='draw'?'Draw':'No contest'};
  const ok=p.w===r.winner,m=methodOf(r);
  let pts=ok?1:0;const mOk=ok&&p.method&&p.method===m,rOk=ok&&mOk&&m!=='Decision'&&p.round&&+p.round===+r.round;
  if(mOk)pts++;if(rOk)pts++;
  return {state:ok?'win':'loss',pts,mOk,rOk};
}

/* ---------- render ---------- */
let E=null,R=null,cur=null,rec=null;
function boutHTML(b,i){
  const lk=lockAt(cur,b),locked=lk!=null&&now()>=lk;
  const p=(rec.picks||{})[key(b)]||{};
  const res=(R.events.find(x=>x.id===cur.id)||{bouts:[]}).bouts.find(x=>key(x)===key(b));
  const sc=score(p,res);
  const o=b.odds||{};const side=s=>{const nm=s==='a'?b.aName:b.bName,od=o[s];
    return `<button type="button" class="pk-side ${s}" data-i="${i}" data-w="${s}" aria-pressed="${p.w===s}"${locked?' disabled':''}><span class="nm">${esc(nm||'TBA')}</span>${od!=null?`<span class="o">${od>0?'+'+od:od}</span>`:''}</button>`};
  const rounds=b.rounds||3;
  return `<article class="pk-bout${locked?' locked':''}" data-key="${esc(key(b))}">
    <div class="bout-head"><span class="wc">${esc(b.weightClass||'—')}${b.rounds?' · '+esc(b.rounds)+' rds':''}</span>${b.title?`<span class="belt">🏆 ${esc(b.title)}</span>`:''}<span>${esc(b.segment||'')}</span></div>
    <div class="pk-sides" role="group" aria-label="Pick the winner: ${esc(b.aName)} or ${esc(b.bName)}">${side('a')}${side('b')}</div>
    <div class="pk-opts"><label>Method (optional)<select data-i="${i}" data-f="method"${locked?' disabled':''}><option value="">Any</option>${METHODS.map(m=>`<option${p.method===m?' selected':''}>${m}</option>`).join('')}</select></label>
      <label>Round (optional)<select data-i="${i}" data-f="round"${locked||p.method==='Decision'?' disabled':''}><option value="">Any</option>${Array.from({length:rounds},(_,k)=>`<option${+p.round===k+1?' selected':''}>${k+1}</option>`).join('')}</select></label></div>
    <p class="pk-lock${locked?' is-locked':''}">${lk==null?'Lock time TBA':locked?'🔒 Locked at '+esc(fT.format(new Date(lk))):'Locks '+esc(fT.format(new Date(lk)))}${locked&&!p.w?' · no pick made':''}</p>
    ${sc?`<p class="pk-score ${sc.state==='win'?'ok':sc.state==='loss'?'bad':'na'}">${sc.state==='pending'?'Result pending':sc.state==='void'?esc(sc.why)+' · pick void':sc.state==='win'?`✓ Correct · ${sc.pts} pt${sc.pts>1?'s':''}${sc.mOk?' (method'+(sc.rOk?' + round':'')+')':''}`:'✗ Wrong pick · 0 pts'}</p>`:''}
  </article>`;
}
function renderCard(){
  const el=$('#pk-card');
  if(!cur){el.innerHTML='<p class="muted">No upcoming UFC card in our data right now. Check back after the next weekly update.</p>';return}
  const bouts=(cur.card&&cur.card.bouts)||[];
  const ss=sessions(cur);
  const made=bouts.filter(b=>(rec.picks||{})[key(b)]).length;
  let html=`<div class="pk-bar"><div><h2 class="section-title">${esc(cur.name)}</h2><p class="muted small">${ss.map(s=>esc(s.label)+': '+esc(fT.format(new Date(s.startUTC)))).join(' · ')||'Time TBA'}</p></div>
    <p class="muted small" id="pk-count" role="status">${made} of ${bouts.length} picked · saved in this browser</p></div>`;
  if(!bouts.length)html+='<div class="tba-card">Card TBA</div>';
  let seg=null;bouts.forEach((b,i)=>{if(b.segment!==seg){seg=b.segment;html+=`<h3 class="seg">${esc(seg||'Fight card')}</h3>`}html+=boutHTML(b,i)});
  html+=`<p class="fc-foot"><a href="${esc(ROOT)}events/${encodeURIComponent(cur.id)}/">Event page: times, full card &amp; where to watch →</a></p>`;
  el.innerHTML=html;
}
async function renderStats(){
  const all=await store.all();
  const rows=[];   // scored picks, chronological
  all.sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(r=>{
    const res=R.events.find(x=>x.id===r.eventId);if(!res)return;
    [...res.bouts].reverse().forEach(b=>{const s=score((r.picks||{})[key(b)],b);if(s&&(s.state==='win'||s.state==='loss'))rows.push(s)})});
  const w=rows.filter(s=>s.state==='win').length,l=rows.length-w,pts=rows.reduce((a,s)=>a+(s.pts||0),0);
  let st=0,stT=null;for(let i=rows.length-1;i>=0;i--){const t=rows[i].state;if(stT===null)stT=t;if(t!==stT)break;st++}
  $('#pk-stats').innerHTML=`<div class="pk-stats"><div><b>${w}-${l}</b><small>Record</small></div><div><b>${rows.length?Math.round(100*w/rows.length)+'%':'—'}</b><small>Correct</small></div><div><b>${st?(stT==='win'?'W':'L')+st:'—'}</b><small>Streak</small></div><div><b>${pts}</b><small>Points</small></div></div>`;
  const past=all.filter(r=>(!cur||r.eventId!==cur.id)&&Object.keys(r.picks||{}).length).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('#pk-past').innerHTML=past.length?`<h2 class="section-title">Your past cards</h2><ul class="pk-hist">${past.map(r=>{const res=R.events.find(x=>x.id===r.eventId);
    if(!res)return `<li><b>${esc(r.name)}</b> · ${esc(fD.format(new Date(r.date+'T12:00:00Z')))} · ${Object.keys(r.picks).length} picks · results pending (added after the weekly results update)</li>`;
    const sc=res.bouts.map(b=>score((r.picks||{})[key(b)],b)).filter(s=>s&&(s.state==='win'||s.state==='loss'));const ww=sc.filter(s=>s.state==='win').length;
    return `<li><b>${esc(res.name)}</b> · ${esc(fD.format(new Date(res.date+'T12:00:00Z')))} · ${ww}-${sc.length-ww}, ${sc.reduce((a,s)=>a+s.pts,0)} pts · <a href="${esc(ROOT)}results/${encodeURIComponent(res.id)}/">results</a></li>`}).join('')}</ul>`:'';
}
async function save(){rec.savedAt=new Date().toISOString();await store.put(cur.id,rec)}
document.addEventListener('click',async e=>{
  const btn=e.target.closest&&e.target.closest('.pk-side');if(!btn||!cur)return;
  const b=cur.card.bouts[+btn.dataset.i],lk=lockAt(cur,b);
  if(lk!=null&&now()>=lk){renderCard();return}   /* locked since the page was drawn */
  const k=key(b);rec.picks=rec.picks||{};const p=rec.picks[k]||{};
  if(p.w===btn.dataset.w){delete rec.picks[k]}else{rec.picks[k]={...p,w:btn.dataset.w,at:new Date().toISOString()}}
  await save();renderCard();
});
document.addEventListener('change',async e=>{
  const s=e.target.closest&&e.target.closest('.pk-opts select');if(!s||!cur)return;
  const b=cur.card.bouts[+s.dataset.i],lk=lockAt(cur,b);if(lk!=null&&now()>=lk){renderCard();return}
  const k=key(b);rec.picks=rec.picks||{};const p=rec.picks[k]||{};
  if(!p.w){s.value='';const c=$('#pk-count');if(c)c.textContent='Pick a winner first, then the method or round.';return}
  p[s.dataset.f]=s.value||undefined;if(p.method==='Decision')delete p.round;p.at=new Date().toISOString();rec.picks[k]=p;
  await save();renderCard();
});
const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()});
async function boot(){
  try{
    if(!E)[E,R]=await Promise.all([getJSON(ROOT+'events.json'),getJSON(ROOT+'results.json').catch(()=>({events:[]}))]);
    cur=E.events.filter(e=>e.promotion==='UFC'&&!/postponed|cancel/i.test(e.status||'')&&now()<firstStart(e)+FIN_MS).sort((a,b)=>firstStart(a)-firstStart(b))[0]||null;
    rec=cur?((await store.get(cur.id))||{eventId:cur.id,name:cur.name,date:cur.date,picks:{}}):null;
    renderCard();await renderStats();
  }catch(err){console.error(err);$('#pk-card').innerHTML='<p class="muted">Could not load the card. Please refresh.</p>'}
}
let lockedN=-1;
setInterval(()=>{if(!cur||document.visibilityState!=='visible')return;const n=((cur.card||{}).bouts||[]).filter(b=>{const t=lockAt(cur,b);return t!=null&&now()>=t}).length;
  if(n!==lockedN){lockedN=n;renderCard()}},30000);   /* picks lock live while the page is open */
boot();
})();
