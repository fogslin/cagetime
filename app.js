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

/* labelled session times: headline = main card (startUTC); earlier sessions (prelims, early prelims, pre-shows) listed with their own time */
function timesHTML(e,dt){
  const t=(e.times||[]).filter(x=>x&&x.label&&x.startUTC);if(!t.length)return '';
  return t.map(x=>{const d=new Date(x.startUTC),same=dt&&d.getTime()===dt.getTime();
    const day=dt&&fDayShort.format(d)!==fDayShort.format(dt)?fDayShort.format(d)+' ':'';
    return '<span class="sess"> · '+esc(x.label)+(same?'':' '+esc(day+fTime.format(d)))+'</span>'}).join('');
}
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
    <p class="when">${esc(fDayShort.format(dt))} · ${esc(fTime.format(dt))}${(()=>{const h=(e.times||[]).find(x=>x.startUTC===e.startUTC);return h?' <small>('+esc(h.label)+')</small>':''})()}</p>
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
  const nm=f.profile&&id?`<a class="flink" href="#fighter=${encodeURIComponent(id)}" data-fid="${esc(id)}" aria-label="Open profile: ${esc(name)}">${esc(name)}</a>`:esc(name);
  const nameHTML=side==='b'?`${nm}${flagHTML}`:`${flagHTML}${nm}`;
  const a=age(f.dob);
  const rows=[['Nation',f.nationality],['Height',f.height],['Reach',f.reach],['Stance',f.stance],['Division',f.weightClass],['Age',a]];
  return `<div class="fighter ${side}">
    <div class="fhead">${avatarHTML(f,name,40)}<div class="fname">${nameHTML}</div></div>
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
      <div class="time">${dt?esc(fTime.format(dt)):`<span class="tba">${e.times&&e.times.length?'Main card time TBA':'Start time TBA'}</span>`}<small>${dt?esc(fDayShort.format(dt))+' · '+esc(rel(dt-Date.now())):esc(fDayShort.format(new Date(e.date+'T12:00:00')))+' (venue date)'}${timesHTML(e,dt)}${e.timeNote?' · '+esc(e.timeNote):''}</small></div>
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

/* ---------- fighter photos / initials ---------- */
function initials(n){const w=String(n||'?').replace(/["'].*?["']/g,'').trim().split(/\s+/).filter(Boolean);return ((w[0]||'?')[0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase()}
function avatarHTML(f,name,size){
  if(f&&f.photo)return `<img class="ava" src="${esc(f.photo)}" alt="${esc(name)}" width="${size}" height="${size}" loading="lazy" decoding="async" title="Photo: ${esc(f.photo_credit||'Wikimedia Commons')}, ${esc(f.photo_license||'')}">`;
  return `<span class="ava ava-ph" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px" aria-hidden="true">${esc(initials(name))}</span>`;
}

/* ---------- fighter profile (modal + #fighter=<id> deep link) ---------- */
const PCACHE={};
let lastFocus=null;
const pct=v=>v==null?'—':esc((+v).toFixed(v%1?1:0))+'%';
const num=v=>v==null?'—':esc(v);
const RES={W:['Win','w'],L:['Loss','l'],D:['Draw','d'],NC:['NC','nc']};
function loadProfile(id){
  if(!PCACHE[id])PCACHE[id]=fetch('data/fighters/'+encodeURIComponent(id)+'.json').then(r=>{if(!r.ok)throw new Error('profile '+r.status);return r.json()}).catch(e=>{delete PCACHE[id];throw e});
  return PCACHE[id];
}
function dlg(){
  let d=document.getElementById('fp');
  if(!d){
    d=document.createElement('dialog');d.id='fp';d.className='fp';d.setAttribute('aria-labelledby','fp-title');
    d.innerHTML='<div class="fp-in"><button class="fp-x" type="button" aria-label="Close profile">✕</button><div class="fp-body"></div></div>';
    document.body.appendChild(d);
    d.querySelector('.fp-x').onclick=()=>closeProfile();
    d.addEventListener('cancel',ev=>{ev.preventDefault();closeProfile()});
    d.addEventListener('click',ev=>{if(ev.target===d)closeProfile()});
  }
  return d;
}
let baseHash='';
function closeProfile(){
  const d=document.getElementById('fp');if(d&&d.open)d.close();
  document.documentElement.classList.remove('fp-lock');
  if(location.hash.startsWith('#fighter='))history.replaceState(null,'',location.pathname+location.search+baseHash);
  if(lastFocus&&document.contains(lastFocus))lastFocus.focus();
}
function oppHTML(x){
  const o=x.opponent_id&&F[x.opponent_id]&&F[x.opponent_id].profile;
  return o?`<a href="#fighter=${encodeURIComponent(x.opponent_id)}">${dash(x.opponent)}</a>`:dash(x.opponent);
}
function la(v){return v&&v[0]!=null?`${esc(v[0])}<small>/${v[1]==null?'—':esc(v[1])}</small>`:'—'}
function statsHTML(x){
  const s=x.stats,o=x.opp_stats||{};
  if(!s)return'';
  const rows=[['Sig. strikes',la(s.sig_str),la(o.sig_str)],['Total strikes',la(s.total_str),la(o.total_str)],['Takedowns',la(s.td),la(o.td)],
    ['Sub. attempts',num(s.sub_att),num(o.sub_att)],['Knockdowns',num(s.kd),num(o.kd)],['Reversals',num(s.rev),num(o.rev)],['Control time',num(s.ctrl),num(o.ctrl)]];
  return `<details class="fx-st"><summary>Fight stats</summary><table><thead><tr><th></th><th>${esc(F_cur_name)}</th><th>${dash(x.opponent)}</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>
    <p class="fx-src">Landed/attempted · source: <a href="${esc(safeUrl(x.stats_source))}" target="_blank" rel="noopener nofollow">ESPN</a></p></details>`;
}
let F_cur_name='';
function fightHTML(x){
  const r=RES[x.result]||[x.result||'—','u'];
  const dec=x.method==='Decision'&&x.round==null;
  const sr=x.scheduled&&/^(\d+) x (\d+) Min/.exec(x.scheduled)||x.scheduled&&/^(\d+) x/.exec(x.scheduled);
  const rnd=x.round!=null?esc(x.round):(dec&&sr?esc(sr[1]):'—');
  const tm=x.time?esc(x.time):(dec&&sr?(sr[2]||'5')+':00':'—');
  return `<li class="fx fx-${r[1]}${x.counts===false?' fx-ex':''}">
    <span class="fx-r" title="${esc(r[0])}">${esc(x.result||'—')}</span>
    <div class="fx-main">
      <div class="fx-top"><b class="fx-opp">${oppHTML(x)}</b>${x.title_fight?`<span class="belt" title="Title fight">🏆 ${esc(x.title_fight)}</span>`:''}</div>
      <div class="fx-meth">${dash(x.method)}${x.method_detail?` · ${esc(x.method_detail)}`:''} <span class="fx-rt">R${rnd} · ${tm}</span></div>
      <div class="fx-ev">${fmtDateISO(x.date)} · ${x.event_url?`<a href="${esc(safeUrl(x.event_url))}" target="_blank" rel="noopener">${dash(x.event)}</a>`:dash(x.event)}${x.location?` · ${esc(x.location)}`:''}</div>
      ${x.counts===false||x.note?`<div class="fx-note">${esc(x.note||'Not counted in pro record')}</div>`:''}
      ${statsHTML(x)}
    </div></li>`;
}
function bars(m,total,label){
  const k=[['ko','KO/TKO'],['sub','Submission'],['dec','Decision'],['dq','DQ']];
  if(!total)return `<div class="pbars"><h4>${label}</h4><p class="muted">—</p></div>`;
  return `<div class="pbars"><h4>${label}</h4>${k.map(([a,b])=>`<div class="pbar"><span>${b}</span><i><b style="width:${Math.round(100*(m[a]||0)/total)}%"></b></i><em>${m[a]||0}</em></div>`).join('')}${m.other?`<div class="pbar"><span>Other</span><i><b style="width:${Math.round(100*m.other/total)}%"></b></i><em>${m.other}</em></div>`:''}</div>`;
}
function otherHTML(os){
  return os.map(s=>{const l=s.listed||{},bs=s.bouts||[];
    return `<section class="fp-sec fp-other"><h3>${esc(s.label)} <small>${bs.length} pro bout${bs.length===1?'':'s'} listed on Tapology</small></h3>
      <p class="fp-line"><span>Listed results: <b>${l.W||0}-${l.L||0}-${l.D||0}</b>${l.NC?`, ${l.NC} NC`:''} (W-L-D)</span></p>
      <p class="fp-small">${esc(s.note||'')}</p>
      <ol class="fx-list">${bs.map(fightHTML).join('')}</ol></section>`}).join('');
}
function profileHTML(id,p){
  const f=F[id]||{},name=p.name||f.name||'Fighter',t=p.totals||{};F_cur_name=name;
  const a=age(f.dob),fl=flag(f.cc);
  const st=t.streak?`${t.streak.count} ${({W:'win',L:'loss',D:'draw',NC:'no contest'})[t.streak.type]||''}${t.streak.count>1?(t.streak.type==='L'?'es':'s'):''}`:'—';
  const bio=[['Age',a],['Born',f.dob?fmtDateISO(f.dob):null],['Nation',f.nationality],['Height',f.height],['Reach',f.reach],['Stance',f.stance],['Division',f.weightClass],
    ['Hometown',(p.bio||{}).born],['Fights out of',(p.bio||{}).fighting_out_of],['Team',(p.bio||{}).affiliation]];
  const ph=p.photo||null;
  const u=p.ufc,c=u&&u.career;
  const up=(p.upcoming||[])[0];
  const fights=p.fights||[],os=p.other_sports||[],onlyOther=!fights.length&&os.length>0,o0=os[0]||{},l0=o0.listed||{};
  const recLine=onlyOther?`${l0.W||0}-${l0.L||0}-${l0.D||0} <small>${esc(o0.label)} bouts listed on Tapology (W-L-D) · no official record published</small>`
    :`${t.wins!=null?`${t.wins}-${t.losses}-${t.draws}${t.nc?`, ${t.nc} NC`:''}`:dash(f.record)} <small>pro MMA (W-L-D)</small>`;
  return `<header class="fp-head">${avatarHTML(f,name,112)}
      <div><p class="eyebrow">Fighter profile</p><h2 id="fp-title">${fl?`<span class="flag" aria-hidden="true">${fl}</span> `:''}${esc(name)}</h2>
      ${p.nickname||f.nickname?`<p class="fp-nick">“${esc(p.nickname||f.nickname)}”</p>`:''}
      <p class="fp-rec">${recLine}</p></div></header>
    ${ph?`<p class="fp-credit">Photo: ${esc(ph.photo_credit||'—')} · <a href="${esc(safeUrl(ph.photo_license_url||ph.photo_source))}" target="_blank" rel="noopener license">${esc(ph.photo_license||'')}</a> · <a href="${esc(safeUrl(ph.photo_source))}" target="_blank" rel="noopener">Wikimedia Commons</a> (cropped)</p>`:''}
    ${up?`<p class="fp-next">Next: vs ${up.opponent_id&&F[up.opponent_id]&&F[up.opponent_id].profile?`<a href="#fighter=${encodeURIComponent(up.opponent_id)}">${dash(up.opponent)}</a>`:dash(up.opponent)} · ${fmtDateISO(up.date)} · ${dash(up.event)}${up.title_fight?` · 🏆 ${esc(up.title_fight)}`:''}</p>`:''}
    <dl class="fp-bio">${bio.map(([k,v])=>`<div><dt>${k}</dt><dd>${dash(v)}</dd></div>`).join('')}</dl>
    ${onlyOther?`<section class="fp-sec"><h3>Pro MMA record</h3><p class="muted">No professional MMA bouts on Tapology.</p></section>`:`<section class="fp-sec"><h3>Pro MMA record</h3>
      <div class="fp-tot"><div class="w"><b>${num(t.wins)}</b><small>Wins</small></div><div class="l"><b>${num(t.losses)}</b><small>Losses</small></div><div><b>${num(t.draws)}</b><small>Draws</small></div><div><b>${num(t.nc)}</b><small>No contests</small></div></div>
      <p class="fp-line"><span>Streak: <b>${st}</b></span><span>Title fights: <b>${num(t.title_fights)}</b>${t.title_fights?` (${t.title_fight_wins} won)`:''}</span></p>
      <div class="fp-bars">${bars(t.win_methods||{},t.wins,'Wins by method')}${bars(t.loss_methods||{},t.losses,'Losses by method')}</div>
    </section>`}
    ${u?`<section class="fp-sec"><h3>UFC career averages</h3>${c?`<dl class="fp-avg">
      ${[['SLpM',num(c.slpm),'Sig. strikes landed per min'],['Str. Acc',pct(c.str_acc),'Sig. strike accuracy'],['SApM',num(c.sapm),'Sig. strikes absorbed per min'],['Str. Def',pct(c.str_def),'Sig. strike defence'],
         ['TD Avg',num(c.td_avg),'Takedowns per 15 min'],['TD Acc',pct(c.td_acc),'Takedown accuracy'],['TD Def',pct(c.td_def),'Takedown defence'],['Sub Avg',num(c.sub_avg),'Sub. attempts per 15 min']]
        .map(([k,v,tt])=>`<div title="${tt}"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="fp-small">SLpM, Str. Acc, TD Avg, TD Acc, Sub Avg: ESPN career stats. SApM, Str. Def, TD Def: calculated by CageTime from ESPN per-fight stats of ${num(c.computed_from_fights)} UFC fights. ${u.fights_with_stats} of ${u.ufc_fights} UFC fights have per-fight stats.</p>`:'<p class="muted">No UFC per-fight stats found — shown as —.</p>'}</section>`:''}
    ${onlyOther?'':`<section class="fp-sec"><h3>Fight history <small>${fights.length} pro MMA bout${fights.length===1?'':'s'}</small></h3>
      ${fights.length?`<ol class="fx-list">${fights.map(fightHTML).join('')}</ol>`:'<p class="muted">No professional MMA fights on record.</p>'}</section>`}
    ${otherHTML(os)}
    <footer class="fp-foot"><p>Last updated ${fmtDateISO(p.updated)}. "—" = not available from our sources. Decisions show the scheduled final round.</p>
      <p>Sources: ${(p.sources||[]).map((s,i)=>`<a href="${esc(safeUrl(s))}" target="_blank" rel="noopener nofollow">[${i+1}] ${esc(String(s).replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`).join(' ')} · <a href="credits.html">Photo credits</a></p></footer>`;
}
function openProfile(id,push){
  if(!id)return;
  const d=dlg(),body=d.querySelector('.fp-body'),f=F[id];
  if(!d.open){lastFocus=document.activeElement;if(!location.hash.startsWith('#fighter='))baseHash=location.hash;try{d.showModal()}catch(_){d.setAttribute('open','')}}
  document.documentElement.classList.add('fp-lock');
  if(push!==false&&location.hash!=='#fighter='+encodeURIComponent(id))history.pushState(null,'','#fighter='+encodeURIComponent(id));
  if(!f||!f.profile){body.innerHTML=`<p class="muted">No profile for this fighter yet.</p>`;return}
  body.innerHTML=`<header class="fp-head">${avatarHTML(f,f.name,112)}<div><p class="eyebrow">Fighter profile</p><h2 id="fp-title">${esc(f.name)}</h2><p class="muted">Loading career…</p></div></header>`;
  d.querySelector('.fp-in').scrollTop=0;
  loadProfile(id).then(p=>{if(location.hash==='#fighter='+encodeURIComponent(id)||push===false){body.innerHTML=profileHTML(id,p);d.querySelector('.fp-in').scrollTop=0}})
    .catch(()=>{body.innerHTML=`<header class="fp-head">${avatarHTML(f,f.name,112)}<div><h2 id="fp-title">${esc(f.name)}</h2><p class="muted">Could not load this profile. Please try again.</p></div></header>`});
}
function routeHash(){
  const m=/^#fighter=([^&]+)/.exec(location.hash);
  if(m)openProfile(decodeURIComponent(m[1]),false);
  else{const d=document.getElementById('fp');if(d&&d.open){d.close();document.documentElement.classList.remove('fp-lock')}}
}
document.addEventListener('click',ev=>{
  const a=ev.target.closest&&ev.target.closest('a[href^="#fighter="]');
  if(!a||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button)return;
  ev.preventDefault();openProfile(decodeURIComponent(a.getAttribute('href').slice(9)));
});
window.addEventListener('popstate',routeHash);
window.addEventListener('hashchange',routeHash);

/* ---------- boot ---------- */
const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()});
/* shared helpers for other pages (rankings.js) */
const fightersReady=$('#list')?null:getJSON('fighters.json').then(f=>{F=f.fighters||{};FU=f.updated;const u=$('#fupd');if(u&&FU)u.textContent=FU;return F});
window.CageTime={esc,dash,safeUrl,flag,avatarHTML,initials,openProfile,routeHash,fmtDateISO,PROMO,getJSON,fighters:()=>F,fightersReady};
if(fightersReady){fightersReady.then(()=>{if(location.hash.startsWith('#fighter='))routeHash()}).catch(err=>console.error(err));return}
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
  if(location.hash.startsWith('#fighter='))routeHash();
}).catch(err=>{console.error(err);$('#list').innerHTML='<p class="muted">Could not load event data. Please refresh.</p>'});
})();
