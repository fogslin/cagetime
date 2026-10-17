/* CageTime — static, no build step. Reads events.json + fighters.json. */
(function(){
'use strict';
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const guess={US:/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise)/,CA:/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina|St_Johns)/,UK:/^Europe\/London/,IE:/^Europe\/Dublin/,AU:/^Australia\//,IN:/^Asia\/(Kolkata|Calcutta)/,DE:/^Europe\/Berlin/,BR:/^America\/(Sao_Paulo|Fortaleza|Recife|Manaus|Bahia|Belem)/};
// AFFILIATE PLACEHOLDERS — replace href with real tracked links once approved. No real IDs here.
const AFF={"Paramount+":"#aff-paramount-PLACEHOLDER","DAZN":"#aff-dazn-PLACEHOLDER","UFC Fight Pass":"#aff-fightpass-PLACEHOLDER","Prime Video":"#aff-prime-PLACEHOLDER"};
const PROMO={UFC:['#e5132b','#fff'],PFL:['#2f6bff','#fff'],ONE:['#f6c343','#111'],RIZIN:['#c9a227','#111'],KSW:['#ffffff','#111'],OKTAGON:['#ff7a00','#111'],'Cage Warriors':['#00a3a3','#fff'],BKFC:['#8b1e1e','#fff'],LFA:['#7c4dff','#fff']};
const BIG=['UFC','PFL','ONE','RIZIN','KSW'];
const LIVE_MS=6*3600e3;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dash=v=>(v==null||v==='')?'—':esc(v);
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'#';

const fDay=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'});
const fDayShort=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'});
const fTime=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const fDate=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'});

function flag(cc){
  if(!cc)return'';cc=String(cc).toUpperCase();
  const sub={EN:'gbeng',SC:'gbsct',WA:'gbwls'}[cc];
  if(sub)return String.fromCodePoint(0x1F3F4,...[...sub].map(c=>0xE0000+c.charCodeAt(0)),0xE007F);
  if(cc==='UK')cc='GB';if(cc==='KO')cc='XK';
  if(!/^[A-Z]{2}$/.test(cc))return'';
  return String.fromCodePoint(...[...cc].map(c=>0x1F1E6+c.charCodeAt(0)-65));
}
function age(dob){
  if(!dob)return null;const d=new Date(dob+'T00:00:00Z');if(isNaN(d))return null;
  const n=new Date();let a=n.getUTCFullYear()-d.getUTCFullYear();
  if(n.getUTCMonth()<d.getUTCMonth()||(n.getUTCMonth()===d.getUTCMonth()&&n.getUTCDate()<d.getUTCDate()))a--;return a;
}
function rel(ms){
  const m=Math.round(ms/60000),h=Math.round(ms/3600e3),d=Math.round(ms/864e5);
  if(Math.abs(m)<60)return m>=0?`in ${m} min`:`${-m} min ago`;
  if(Math.abs(h)<36)return h>=0?`in ${h} h`:`${-h} h ago`;
  return d>=0?`in ${d} days`:`${-d} days ago`;
}
function fmtOdds(o){return o==null?'—':(o>0?'+'+o:String(o))}
function fmtDateISO(s){if(!s)return'—';const d=new Date(s.length<=10?s+'T12:00:00Z':s);return isNaN(d)?esc(s):fDate.format(d)}

let D=null,F={},FU=null,state={};

function startOf(e){return e.startUTC?new Date(e.startUTC):null}
function isGone(e){const dt=startOf(e);if(dt)return dt.getTime()<Date.now()-LIVE_MS;
  const v=new Date(e.date+'T23:59:59Z');return v.getTime()<Date.now()-LIVE_MS}
function isLive(e){const dt=startOf(e);return !!dt&&dt.getTime()<=Date.now()&&dt.getTime()>Date.now()-LIVE_MS}

function broadcaster(e,c){return (e.broadcasters&&e.broadcasters[c])||'TBA'}
function watchHTML(e,c){
  const b=broadcaster(e,c),aff=Object.keys(AFF).find(k=>b.includes(k));
  return `<span class="lbl">Watch in ${esc(D.countries[c]||c)}</span>${b==='TBA'?'<span class="tba">TBA</span>':'<b>'+esc(b)+'</b>'}
    ${aff?`<a class="aff" href="${AFF[aff]}" rel="sponsored nofollow">Get ${esc(aff)} → [affiliate slot]</a>`:''}`;
}

/* ---------- hero: next big event ---------- */
let cdTimer=null;
function pickNext(){
  const now=Date.now();
  const up=D.events.filter(e=>e.startUTC&&!/postponed|cancel/i.test(e.status||'')).sort((a,b)=>new Date(a.startUTC)-new Date(b.startUTC));
  const live=up.find(e=>e.featured&&isLive(e));
  if(live)return live;
  return up.find(e=>e.featured&&new Date(e.startUTC).getTime()>now)||up.find(e=>BIG.includes(e.promotion)&&new Date(e.startUTC).getTime()>now)||null;
}
function renderNext(){
  const box=$('#next .next-body'),e=pickNext();
  if(!e){box.innerHTML='<p class="muted">No upcoming headline event in our data.</p>';return}
  const dt=new Date(e.startUTC),c=state.country;
  box.innerHTML=`<span class="badge" style="--promo:${(PROMO[e.promotion]||[])[0]||'var(--red)'};--promo-ink:${(PROMO[e.promotion]||[])[1]||'#fff'}">${esc(e.promotion)}</span>
    <h2>${esc(e.name)}</h2>
    <p class="when">${esc(fDayShort.format(dt))} · ${esc(fTime.format(dt))}</p>
    <div class="countdown" role="timer" aria-label="Countdown to ${esc(e.name)}"><div><b id="cd-d">0</b><small>days</small></div><div><b id="cd-h">0</b><small>hrs</small></div><div><b id="cd-m">0</b><small>min</small></div><div><b id="cd-s">0</b><small>sec</small></div></div>
    <p class="watch-line">Watch in ${esc(D.countries[c]||c)}: <b style="color:var(--green)">${esc(broadcaster(e,c))}</b></p>
    <p class="watch-line"><a href="#ev-${esc(e.id)}">See the full card ↓</a></p>`;
  clearInterval(cdTimer);
  const tick=()=>{let ms=dt.getTime()-Date.now();
    if(ms<=0){const cd=box.querySelector('.countdown');if(cd)cd.outerHTML='<p><span class="live-pill">Live now</span></p>';clearInterval(cdTimer);return}
    const s=Math.floor(ms/1000);
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    set('cd-d',Math.floor(s/86400));set('cd-h',String(Math.floor(s%86400/3600)).padStart(2,'0'));set('cd-m',String(Math.floor(s%3600/60)).padStart(2,'0'));set('cd-s',String(s%60).padStart(2,'0'));};
  tick();cdTimer=setInterval(tick,1000);
}

/* ---------- fight card ---------- */
function fighterHTML(id,fallbackName,side,odds,favSide){
  const f=F[id]||{},name=f.name||fallbackName||'TBA';
  const fl=flag(f.cc);
  const flagHTML=fl?`<span class="flag" role="img" aria-label="${esc(f.nationality||'')}">${fl}</span>`:'';
  const nameHTML=side==='b'?`${esc(name)}${flagHTML}`:`${flagHTML}${esc(name)}`;
  const a=age(f.dob);
  const rows=[['Nation',f.nationality],['Height',f.height],['Reach',f.reach],['Stance',f.stance],['Division',f.weightClass],['Age',a]];
  return `<div class="fighter ${side}">
    <div class="fname">${nameHTML}</div>
    <div class="rec">${dash(f.record)} <small>W-L-D</small></div>
    <dl class="stats">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${dash(v)}</dd>`).join('')}</dl>
    ${odds!==undefined?`<span class="odds${favSide===side?' fav':''}" title="Moneyline (American odds)">${fmtOdds(odds)}</span>`:''}
    ${f.updated?`<div class="upd">Stats updated ${fmtDateISO(f.updated)}</div>`:''}
  </div>`;
}
function cardHTML(e){
  const c=e.card||{};
  const bouts=c.bouts||[];
  if(!bouts.length)return `<div class="tba-card">${/postponed|cancel/i.test(e.status||'')?'Event postponed — card TBA':'Card TBA'}</div>
    ${c.sources&&c.sources.length?`<p class="fc-foot">Checked: ${c.sources.map((s,i)=>`<a href="${esc(safeUrl(s))}" target="_blank" rel="noopener">[${i+1}]</a>`).join(' ')}${c.updated?' · '+fmtDateISO(c.updated):''}</p>`:''}`;
  let html=c.note?`<p class="notes fc-note">${esc(c.note)}</p>`:'',seg=null,anyOdds=false;
  bouts.forEach(b=>{
    if((b.segment||'Fight card')!==seg){seg=b.segment||'Fight card';html+=`<h4 class="seg">${esc(seg)}</h4>`}
    const o=b.odds;let fav=null;
    if(o&&o.a!=null&&o.b!=null){anyOdds=true;fav=o.a<o.b?'a':(o.b<o.a?'b':null)}
    html+=`<article class="bout">
      <div class="bout-head"><span class="wc">${dash(b.weightClass)}${b.rounds?` · ${esc(b.rounds)} rds`:''}</span>${b.title?`<span class="belt">🏆 ${esc(b.title)}</span>`:''}${b.discipline&&b.discipline!=='MMA'?`<span class="tag">${esc(b.discipline)}</span>`:''}</div>
      <div class="vs">${fighterHTML(b.a,b.aName,'a',o?o.a:undefined,fav)}<div class="vs-mid" aria-hidden="true">VS</div>${fighterHTML(b.b,b.bName,'b',o?o.b:undefined,fav)}</div>
      ${b.note?`<p class="notes">${esc(b.note)}</p>`:''}
    </article>`});
  const oi=e.odds;
  html+=`<p class="fc-foot">Card source: ${(c.sources||[]).map((s,i)=>`<a href="${esc(safeUrl(s))}" target="_blank" rel="noopener">[${i+1}]</a>`).join(' ')||'—'}${c.updated?' · checked '+fmtDateISO(c.updated):''}. Bouts can change late; "—" = not found in our sources.
    ${anyOdds&&oi?`<br>Odds as of ${esc(oi.asOf)} — ${esc(oi.method||'')} (<a href="${esc(safeUrl(oi.url))}" target="_blank" rel="noopener nofollow">${esc(oi.source)}</a>). Lower number = favourite.<span class="gamble">18+ · Odds change · Gamble responsibly.</span>`:''}</p>`;
  return html;
}

/* ---------- list ---------- */
function eventHTML(e,c){
  const dt=startOf(e),live=isLive(e),post=/postponed|cancel/i.test(e.status||'');
  const pc=PROMO[e.promotion]||['var(--red)','#fff'];
  const nb=(e.card&&e.card.bouts||[]).length;
  return `<article class="card" id="ev-${esc(e.id)}" style="--promo:${pc[0]};--promo-ink:${pc[1]}">
   <div class="card-main">
    <div class="card-top"><span class="badge">${esc(e.promotion)}</span>${live?'<span class="tag live">Live now</span>':''}${post?`<span class="tag warn">${esc(e.status)}</span>`:''}${e.featured?'<span class="tag">Headline event</span>':''}</div>
    <h3>${esc(e.name)}</h3>
    <div class="card-grid">
      <div class="time">${dt?esc(fTime.format(dt)):'<span class="tba">Start time TBA</span>'}<small>${dt?esc(fDayShort.format(dt))+' · '+esc(rel(dt-Date.now())):esc(fDayShort.format(new Date(e.date+'T12:00:00')))+' (venue date)'}${dt&&e.timeNote?' · '+esc(e.timeNote):''}</small></div>
      <div class="watch">${watchHTML(e,c)}</div>
      <div class="venue">📍 ${dash(e.venue)}</div>
    </div>
    ${e.notes?`<p class="notes">${esc(e.notes)}</p>`:''}
    <p class="src">Event sources: ${(e.sources||[]).map((s,i)=>`<a href="${esc(safeUrl(s))}" target="_blank" rel="noopener">[${i+1}]</a>`).join(' ')}</p>
   </div>
   <details class="fc" data-id="${esc(e.id)}"><summary><span>Fight card <span class="count">${nb?nb+' bouts':'TBA'}</span></span><span class="chev" aria-hidden="true"></span></summary><div class="fc-body"></div></details>
  </article>`;
}
function render(){
  const c=state.country=$('#country').value;try{localStorage.ct=c}catch(_){}
  const p=$('#promo').value;
  let html='',last='';
  D.events.filter(e=>(!p||e.promotion===p)&&!isGone(e)).forEach(e=>{
    const dt=startOf(e);
    const day=dt?fDay.format(dt):fDay.format(new Date(e.date+'T12:00:00'));
    if(day!==last){html+=`<h3 class="day">${esc(day)}</h3>`;last=day}
    html+=eventHTML(e,c)});
  $('#list').innerHTML=html||'<p class="muted">No upcoming events for this filter.</p>';
  renderNext();
}
document.addEventListener('toggle',ev=>{
  const d=ev.target;if(!(d instanceof HTMLDetailsElement)||!d.classList.contains('fc')||!d.open)return;
  const body=d.querySelector('.fc-body');if(body.dataset.done)return;
  const e=D.events.find(x=>x.id===d.dataset.id);if(!e)return;
  body.innerHTML=cardHTML(e);body.dataset.done='1';
},true);

/* ---------- boot ---------- */
const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()});
Promise.all([getJSON('events.json'),getJSON('fighters.json').catch(()=>null)]).then(([d,f])=>{
  D=d;if(f){F=f.fighters||{};FU=f.updated}
  D.events.forEach((e,i)=>{if(!e.id)e.id='e'+i});
  D.events.sort((a,b)=>{const ta=a.startUTC?new Date(a.startUTC):new Date(a.date+'T12:00:00Z'),tb=b.startUTC?new Date(b.startUTC):new Date(b.date+'T12:00:00Z');return ta-tb});
  const cs=$('#country'),ps=$('#promo');
  let saved=null;try{saved=localStorage.ct}catch(_){}
  const def=(saved&&D.countries[saved])?saved:(Object.keys(guess).find(k=>guess[k].test(tz))||'US');
  for(const[k,v] of Object.entries(D.countries))cs.add(new Option(v,k,false,k===def));
  [...new Set(D.events.map(e=>e.promotion))].forEach(p=>ps.add(new Option(p,p)));
  $('#tz').textContent='Times shown in your time zone: '+tz;
  $('#upd').textContent=D.updated;if(FU)$('#fupd').textContent=FU;
  cs.onchange=ps.onchange=render;render();
  if(location.hash.startsWith('#ev-')){const el=document.getElementById(location.hash.slice(1));if(el)el.scrollIntoView()}
}).catch(err=>{console.error(err);$('#list').innerHTML='<p class="muted">Could not load event data. Please refresh.</p>'});
})();
