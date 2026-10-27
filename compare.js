/* CageTime fighter head-to-head (/compare/?a=<id>&b=<id>). Reads fighters.json and data/fighters/<id>.json only.
   Every value comes from those files; anything missing shows as "—". */
(function(){
'use strict';
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(_){return '/'}})();
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const D=v=>(v==null||v==='')?'—':esc(v);
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const fDate=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'});
const fd=s=>{if(!s)return '—';const d=new Date(s.length<=10?s+'T12:00:00Z':s);return isNaN(d)?esc(s):fDate.format(d)};
function flag(cc){if(!cc)return'';cc=String(cc).toUpperCase();if(cc==='UK')cc='GB';if(!/^[A-Z]{2}$/.test(cc))return'';return String.fromCodePoint(...[...cc].map(c=>0x1F1E6+c.charCodeAt(0)-65))}
function age(dob){if(!dob)return null;const d=new Date(dob+'T00:00:00Z');if(isNaN(d))return null;const n=new Date();let a=n.getUTCFullYear()-d.getUTCFullYear();
  if(n.getUTCMonth()<d.getUTCMonth()||(n.getUTCMonth()===d.getUTCMonth()&&n.getUTCDate()<d.getUTCDate()))a--;return a}
function initials(n){const w=String(n||'?').split(/\s+/).filter(Boolean);return ((w[0]||'?')[0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase()}
let F={},IDX=[];const PC={};
const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()});
const prof=id=>PC[id]||(PC[id]=getJSON(ROOT+'data/fighters/'+encodeURIComponent(id)+'.json').catch(e=>{delete PC[id];throw e}));
const sel={a:null,b:null};

/* ---------- search boxes (combobox) ---------- */
function search(q){
  q=norm(q);if(q.length<2)return [];
  const t=q.split(' ');
  return IDX.filter(x=>t.every(w=>x.k.includes(w))).sort((x,y)=>(y.k.startsWith(q)-x.k.startsWith(q))||(y.n.split(' ').some(w=>w.startsWith(t[0]))-x.n.split(' ').some(w=>w.startsWith(t[0])))||x.name.localeCompare(y.name)).slice(0,8);
}
function setupBox(side){
  const inp=$('#cmp-'+side),ul=$('#cmp-'+side+'-list');let items=[],act=-1;
  const close=()=>{ul.hidden=true;inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant');act=-1};
  const draw=()=>{ul.innerHTML=items.map((x,i)=>{const f=F[x.id];return `<li role="option" id="${side}-opt-${i}" data-id="${esc(x.id)}" aria-selected="${i===act}"><span>${flag(f.cc)}</span><span>${esc(f.name)}${f.nickname?` <small>“${esc(f.nickname)}”</small>`:''}<br><small>${D(f.weightClass)} · ${D(f.record)}</small></span></li>`}).join('')||'<li class="muted" aria-disabled="true">No fighter found</li>';
    ul.hidden=false;inp.setAttribute('aria-expanded','true');if(act>=0)inp.setAttribute('aria-activedescendant',side+'-opt-'+act)};
  inp.addEventListener('input',()=>{items=search(inp.value);act=items.length?0:-1;if(inp.value.trim().length<2){close();return}draw()});
  inp.addEventListener('keydown',e=>{if(ul.hidden)return;
    if(e.key==='ArrowDown'){act=Math.min(items.length-1,act+1);draw();e.preventDefault()}
    else if(e.key==='ArrowUp'){act=Math.max(0,act-1);draw();e.preventDefault()}
    else if(e.key==='Enter'&&items[act]){choose(side,items[act].id);close();e.preventDefault()}
    else if(e.key==='Escape')close()});
  ul.addEventListener('mousedown',e=>{const li=e.target.closest('li[data-id]');if(li){e.preventDefault();choose(side,li.dataset.id);close()}});
  inp.addEventListener('blur',()=>setTimeout(close,150));
}
function choose(side,id){sel[side]=id;$('#cmp-'+side).value=F[id]?F[id].name:'';sync();render()}
function sync(){const p=new URLSearchParams();if(sel.a)p.set('a',sel.a);if(sel.b)p.set('b',sel.b);history.replaceState(null,'',location.pathname+(p.toString()?'?'+p:''))}

/* ---------- comparison ---------- */
const pct=(n,d)=>d?Math.round(100*n/d)+'%':'—';
function streak(t){const s=t&&t.streak;if(!s)return null;const w={W:'win',L:'loss',D:'draw',NC:'no contest'}[s.type]||s.type;return s.count+' '+w+(s.count>1?(s.type==='L'?'es':'s'):'')}
function rec(t,f){return t&&t.wins!=null?`${t.wins}-${t.losses}-${t.draws}${t.nc?`, ${t.nc} NC`:''}`:(f.record||null)}
function oppKey(x){return x.opponent_id||('n:'+norm(x.opponent))}
function meetings(pa,idb,nameb){return (pa.fights||[]).filter(x=>x.opponent_id===idb||(!x.opponent_id&&norm(x.opponent)===norm(nameb)))}
function common(pa,pb,ida,idb){
  const A={},B={};(pa.fights||[]).forEach(x=>{if(x.counts===false)return;const k=oppKey(x);if(k===idb)return;(A[k]=A[k]||[]).push(x)});
  (pb.fights||[]).forEach(x=>{if(x.counts===false)return;const k=oppKey(x);if(k===ida)return;(B[k]=B[k]||[]).push(x)});
  return Object.keys(A).filter(k=>B[k]).map(k=>({name:A[k][0].opponent,id:A[k][0].opponent_id,a:A[k],b:B[k]}))
    .sort((x,y)=>String(y.a[0].date>y.b[0].date?y.a[0].date:y.b[0].date).localeCompare(String(x.a[0].date>x.b[0].date?x.a[0].date:x.b[0].date)));
}
const resTxt=x=>`<b class="${esc(x.result)}">${esc(x.result||'—')}</b><small>${D(x.method)}${x.round!=null?' · R'+esc(x.round):''} · ${fd(x.date)}</small>`;
function ava(f,size){return f.photo?`<img class="ava" src="${esc(ROOT+f.photo)}" alt="${esc(f.name)}" width="${size}" height="${size}" title="Photo: ${esc(f.photo_credit||'Wikimedia Commons')}, ${esc(f.photo_license||'')}">`:`<span class="ava ava-ph" style="width:${size}px;height:${size}px" aria-hidden="true">${esc(initials(f.name))}</span>`}
function head(id,p){const f=F[id]||{};return `<div class="cmp-head">${ava(f,88)}<h2>${flag(f.cc)?`<span aria-hidden="true">${flag(f.cc)}</span> `:''}${esc(f.name)}</h2>${p.nickname||f.nickname?`<p class="fp-nick">“${esc(p.nickname||f.nickname)}”</p>`:''}<a class="cmp-link" href="${esc(ROOT)}#fighter=${encodeURIComponent(id)}">Full profile →</a></div>`}
async function render(){
  const out=$('#cmp-out');
  if(!sel.a||!sel.b){out.innerHTML=`<p class="muted">${sel.a||sel.b?'Pick a second fighter to compare.':'Pick two fighters above. Tip: every bout on the <a href="'+esc(ROOT)+'">events page</a> has a Compare button.'}</p>`;return}
  if(sel.a===sel.b){out.innerHTML='<p class="muted">Pick two different fighters.</p>';return}
  out.innerHTML='<p class="muted">Loading careers…</p>';
  let pa,pb;try{[pa,pb]=await Promise.all([prof(sel.a),prof(sel.b)])}catch(e){out.innerHTML='<p class="muted">Could not load one of the profiles. Please try again.</p>';return}
  const a=sel.a,b=sel.b,fa=F[a]||{},fb=F[b]||{},ta=pa.totals||{},tb=pb.totals||{};
  const ca=(pa.ufc||{}).career,cb=(pb.ufc||{}).career;
  const finish=(t,k)=>t.wins?pct((t.win_methods||{})[k]||0,t.wins):'—';
  const fin=t=>t.wins?pct(((t.win_methods||{}).ko||0)+((t.win_methods||{}).sub||0),t.wins):'—';
  const lostFin=t=>t.losses?pct(((t.loss_methods||{}).ko||0)+((t.loss_methods||{}).sub||0),t.losses):'—';
  const n1=v=>v==null?'—':esc(v),p1=v=>v==null?'—':esc((+v).toFixed(v%1?1:0))+'%';
  const rows=[['sec','Record'],['Pro MMA record',D(rec(ta,fa)),D(rec(tb,fb))],['Current streak',D(streak(ta)),D(streak(tb))],['Title fights',ta.title_fights!=null?esc(ta.title_fights)+(ta.title_fights?` (${esc(ta.title_fight_wins)} won)`:''):'—',tb.title_fights!=null?esc(tb.title_fights)+(tb.title_fights?` (${esc(tb.title_fight_wins)} won)`:''):'—'],
    ['sec','Physical'],['Age',D(age(fa.dob)),D(age(fb.dob))],['Height',D(fa.height),D(fb.height)],['Reach',D(fa.reach),D(fb.reach)],['Stance',D(fa.stance),D(fb.stance)],['Division',D(fa.weightClass),D(fb.weightClass)],['Nation',D(fa.nationality),D(fb.nationality)],
    ['sec','How they win and lose'],['Wins by finish',fin(ta),fin(tb)],['Wins by KO/TKO',finish(ta,'ko'),finish(tb,'ko')],['Wins by submission',finish(ta,'sub'),finish(tb,'sub')],['Wins by decision',finish(ta,'dec'),finish(tb,'dec')],['Losses by finish',lostFin(ta),lostFin(tb)]];
  if(ca||cb){rows.push(['sec','UFC career stats (ESPN)']);
    [['Sig. strikes landed / min','slpm',n1],['Sig. strike accuracy','str_acc',p1],['Sig. strikes absorbed / min','sapm',n1],['Sig. strike defence','str_def',p1],['Takedowns / 15 min','td_avg',n1],['Takedown accuracy','td_acc',p1],['Takedown defence','td_def',p1],['Sub. attempts / 15 min','sub_avg',n1]]
      .forEach(([l,k,f])=>rows.push([l,ca?f(ca[k]):'—',cb?f(cb[k]):'—']));}
  const met=meetings(pa,b,fb.name),com=common(pa,pb,a,b);
  const up=(pa.upcoming||[]).find(x=>x.opponent_id===b);
  out.innerHTML=`<div class="cmp-heads">${head(a,pa)}${head(b,pb)}</div>
  <div class="cmp-share"><button type="button" class="btn-sm ghost" id="cmp-copy">Copy link to this comparison</button><span class="muted small" id="cmp-msg" role="status"></span></div>
  ${up?`<p class="ev-done"><b>Scheduled:</b> ${esc(fa.name)} vs. ${esc(fb.name)} · ${fd(up.date)} · ${D(up.event)}</p>`:''}
  <table class="cmp-table"><caption class="sr">${esc(fa.name)} compared with ${esc(fb.name)}</caption><thead class="sr"><tr><td>${esc(fa.name)}</td><th>Stat</th><td>${esc(fb.name)}</td></tr></thead><tbody>
  ${rows.map(r=>r[0]==='sec'?`<tr class="sec"><th colspan="3" scope="colgroup">${esc(r[1])}</th></tr>`:`<tr><td>${r[1]}</td><th scope="row">${esc(r[0])}</th><td>${r[2]}</td></tr>`).join('')}</tbody></table>
  <section class="cmp-sec"><h3>Past meetings</h3>${met.length?`<ul class="cmp-common">${met.map(x=>`<li><div class="r">${resTxt(x)}</div><div class="opp">${D(x.event)}</div><div class="r"><small>${esc(fa.name)}'s result</small></div></li>`).join('')}</ul>`:'<p class="muted">They have not fought each other (pro MMA, per Tapology).</p>'}</section>
  <section class="cmp-sec"><h3>Common opponents <small class="muted">${com.length}</small></h3>${com.length?`<ul class="cmp-common">${com.map(c=>`<li><div class="r">${c.a.map(resTxt).join('')}</div><div class="opp">${c.id&&F[c.id]&&F[c.id].profile?`<a href="${esc(ROOT)}#fighter=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`:esc(c.name)}</div><div class="r">${c.b.map(resTxt).join('')}</div></li>`).join('')}</ul><p class="muted small">Left: ${esc(fa.name)} · right: ${esc(fb.name)}.</p>`:'<p class="muted">No common opponents in their pro MMA records.</p>'}</section>
  <p class="fc-foot">Records, physicals and fight histories: Tapology (profiles updated ${fd(pa.updated)} / ${fd(pb.updated)}). UFC stats: ESPN; SApM, Str. Def and TD Def calculated by CageTime from ESPN per-fight stats. Finish rates count pro MMA wins/losses only. "—" = not available.</p>`;
  $('#cmp-copy').onclick=()=>{const u=location.href,m=$('#cmp-msg');if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(u).then(()=>m.textContent='Link copied',()=>prompt('Copy this link',u));else prompt('Copy this link',u)};
  document.title=`${fa.name} vs ${fb.name}: head-to-head comparison | CageTime`;
}
getJSON(ROOT+'fighters.json').then(j=>{
  F=j.fighters||{};
  IDX=Object.entries(F).filter(([,f])=>f.profile&&f.name).map(([id,f])=>({id,name:f.name,n:norm(f.name),k:norm(f.name+' '+(f.nickname||''))}));
  setupBox('a');setupBox('b');
  const q=new URLSearchParams(location.search);
  ['a','b'].forEach(s=>{const id=q.get(s);if(id&&F[id]){sel[s]=id;$('#cmp-'+s).value=F[id].name}});
  $('#cmp-swap').onclick=()=>{[sel.a,sel.b]=[sel.b,sel.a];$('#cmp-a').value=sel.a?F[sel.a].name:'';$('#cmp-b').value=sel.b?F[sel.b].name:'';sync();render()};
  const bad=['a','b'].filter(s=>q.get(s)&&!F[q.get(s)]);
  render().then(()=>{if(bad.length)$('#cmp-out').insertAdjacentHTML('afterbegin','<p class="muted">A fighter in this link is not in our database any more.</p>')});
}).catch(()=>{$('#cmp-out').innerHTML='<p class="muted">Could not load fighter data. Please refresh.</p>'});
})();
