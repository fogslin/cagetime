/* CageTime rankings page. Data: data/rankings/index.json + data/rankings/<promotion>.json (built by update_rankings.py).
   URL: rankings.html#<promotion>[/<board>], e.g. #ufc, #ufc/media, #one/muay-thai. Fighter drawers come from app.js (#fighter=<id>). */
(function(){
'use strict';
const CT=window.CageTime;
const $=s=>document.querySelector(s);
const {esc,dash,safeUrl,fmtDateISO}=CT;
const main=$('#rankings'),sel=$('#rk-promo');
let IDX=null,cur={p:null,b:null};const CACHE={};

function parseHash(){
  const h=decodeURIComponent(location.hash.slice(1));
  if(!h||h.startsWith('fighter='))return null;
  const [p,b]=h.split('/');return {p:(p||'').toLowerCase(),b:(b||'').toLowerCase()};
}
function load(key){
  if(!CACHE[key])CACHE[key]=CT.getJSON('data/rankings/'+encodeURIComponent(key)+'.json').catch(e=>{delete CACHE[key];throw e});
  return CACHE[key];
}
function promoStyle(name){const c=CT.PROMO[name]||['var(--red)','#fff'];return `--promo:${c[0]};--promo-ink:${c[1]}`}

/* ---------- small pieces ---------- */
function nameHTML(e){
  if(!e)return '—';
  const F=CT.fighters(),f=e.fighter_id&&F[e.fighter_id];
  const fl=CT.flag(e.cc||(f&&f.cc));
  const flagH=fl?`<span class="flag" aria-hidden="true">${fl}</span>`:'';
  const nm=e.fighter_id&&f&&f.profile?`<a class="flink" href="#fighter=${encodeURIComponent(e.fighter_id)}" data-fid="${esc(e.fighter_id)}">${esc(e.name)}</a>`:esc(e.name);
  return flagH+nm;
}
function recHTML(e){
  if(!e)return '';
  const t=e.record?(e.record_src==='source'?'Record as published by the promotion':'Record from the CageTime profile (Tapology)'):'No record given by the source';
  return `<span class="rk-rec" title="${t}">${dash(e.record)}</span>`;
}
function moveHTML(m){
  if(!m)return '<span class="rk-mv" aria-hidden="true"></span>';
  if(m.dir==='new')return '<span class="rk-mv new" title="Not previously ranked">NR</span>';
  const up=m.dir==='up',by=m.by!=null?m.by:'';
  const sr=`${up?'Up':'Down'}${m.by!=null?' '+m.by+(m.by===1?' place':' places'):''}`;
  return `<span class="rk-mv ${up?'up':'down'}" title="${sr}"><span aria-hidden="true">${up?'▲':'▼'}${esc(by)}</span><span class="sr">${sr}</span></span>`;
}
function rankLabel(r){return typeof r==='number'?String(r):esc(r||'—')}
function rowsHTML(list){
  if(!list.length)return '';
  return `<ol class="rk-list">${list.map(e=>`<li><span class="rk-n">${rankLabel(e.rank)}</span><span class="rk-nm">${nameHTML(e)}</span>${moveHTML(e.movement)}</li>`).join('')}</ol>`;
}
function avatar(e,size){
  const F=CT.fighters(),f=(e&&e.fighter_id&&F[e.fighter_id])||{};
  const g={...f};if(!g.photo&&e&&e.photo)g.photo=e.photo;
  return CT.avatarHTML(g,e?e.name:'?',size);
}
function champHTML(d,kind){
  const c=d.champion,i=d.interim;
  const head=c?`<div class="rk-champ">
      ${avatar(c,76)}
      <div class="rk-champ-t"><span class="rk-belt">Champion</span><p class="rk-champ-n">${nameHTML(c)}</p>${recHTML(c)}${c.name_local?`<span class="rk-local" lang="ja">${esc(c.name_local)}</span>`:''}</div>
    </div>`:`<div class="rk-champ is-vacant"><span class="ava ava-ph" style="width:76px;height:76px;font-size:28px" aria-hidden="true">—</span><div class="rk-champ-t"><span class="rk-belt">Champion</span><p class="rk-champ-n">Vacant</p><span class="rk-rec">—</span></div></div>`;
  const ic=i?`<div class="rk-interim">${avatar(i,36)}<div><span class="rk-belt sm">Interim champion</span><p>${nameHTML(i)} ${recHTML(i)}</p></div></div>`:'';
  return head+ic;
}
function divHTML(d,i,kind,promo){
  const id='rk-d-'+i;
  return `<section class="rk-card${kind==='champions'?' rk-card-c':''}" aria-labelledby="${id}">
    <header class="rk-card-h"><h3 id="${id}">${esc(d.name)}</h3>${d.limit?`<span class="rk-lim">${esc(d.limit)}</span>`:''}</header>
    ${champHTML(d,kind)}
    ${d.ranked.length?rowsHTML(d.ranked):(kind==='rankings'?'<p class="rk-empty">No ranked contenders published for this division.</p>':'')}
    ${d.note?`<p class="rk-note">${esc(d.note)}${d.note_url?` <a href="${esc(safeUrl(d.note_url))}" target="_blank" rel="noopener">Source</a>`:''}</p>`:''}
  </section>`;
}
function p4pHTML(list,board,promo,otherBoards){
  if(!list.length){
    const alt=otherBoards.find(b=>b.hasP4P);
    return alt?`<section class="rk-p4p-none" aria-label="Pound-for-pound"><p><b>Pound-for-pound:</b> ${esc(board.label)} has no pound-for-pound list. <a href="#${esc(promo.key)}/${esc(alt.key)}">See the ${esc(alt.label)} P4P</a>.</p></section>`:'';
  }
  return `<section class="rk-p4p" aria-labelledby="rk-p4p-t"><h2 class="section-title" id="rk-p4p-t">Pound-for-pound</h2><div class="rk-p4p-grid">${list.map((d,i)=>{
    const top=d.ranked[0],rest=d.ranked.slice(1);
    return `<section class="rk-card rk-card-p4p" aria-labelledby="rk-p-${i}">
      <header class="rk-card-h"><h3 id="rk-p-${i}">${esc(d.name)}</h3><span class="rk-lim">Top rank</span></header>
      ${top?`<div class="rk-champ">${avatar(top,76)}<div class="rk-champ-t"><span class="rk-belt">#${rankLabel(top.rank)}</span><p class="rk-champ-n">${nameHTML(top)}</p>${recHTML(top)}</div>${moveHTML(top.movement)}</div>`:''}
      ${rowsHTML(rest)}</section>`}).join('')}</div></section>`;
}
function asOfHTML(b,d){
  const src=b.source_url||d.source_url;
  const when=b.as_of_is_fetch_date?`checked ${fmtDateISO(b.as_of)} <span class="muted">(the source gives no update date)</span>`:`as of ${fmtDateISO(b.as_of)}${b.as_of_text?` <span class="muted">(“${esc(b.as_of_text)}”)</span>`:''}`;
  return `<p class="rk-src"><span class="lbl">Source</span> <a href="${esc(safeUrl(src))}" target="_blank" rel="noopener">${esc(src.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))}</a> · ${when}</p>`;
}

/* ---------- page ---------- */
function render(d,bkey){
  const boards=d.boards;
  const b=boards.find(x=>x.key===bkey)||boards[0];
  cur={p:d.key,b:b.key};
  const info=IDX.promotions.find(p=>p.key===d.key)||{};
  const kindLbl=b.kind==='champions'?'Champions only':'Official rankings';
  const tabs=boards.length>1?`<nav class="rk-tabs" aria-label="${esc(d.promotion)} lists">${boards.map(x=>`<a href="#${esc(d.key)}/${esc(x.key)}"${x.key===b.key?' aria-current="page" class="is-active"':''}>${esc(x.label)}<small>${esc(x.kind==='champions'?'Champions only':x.sport==='MMA'?'Rankings':x.sport)}</small></a>`).join('')}</nav>`:'';
  const others=boards.filter(x=>x!==b).map(x=>({key:x.key,label:x.label,hasP4P:x.p4p.length>0}));
  const sport=b.sport&&b.sport!=='MMA'?`<span class="tag warn">${esc(b.sport)} · not MMA</span>`:'';
  main.innerHTML=`<header class="rk-head" style="${promoStyle(d.promotion)}">
      <div class="rk-head-t"><span class="badge">${esc(d.promotion)}</span><span class="tag${b.kind==='champions'?' warn':''}">${kindLbl}</span>${sport}</div>
      <h2 class="rk-h2">${esc(d.promotion_full)} <span>${esc(b.label)}</span></h2>
      ${asOfHTML(b,d)}
      ${b.note?`<p class="rk-bnote">${esc(b.note)}</p>`:''}
      ${d.movement_note&&b.kind==='rankings'?`<p class="rk-bnote dim">${esc(d.movement_note)}</p>`:''}
    </header>
    ${tabs}
    ${b.kind==='rankings'?p4pHTML(b.p4p,b,d,others):''}
    <section aria-labelledby="rk-div-t"><h2 class="section-title" id="rk-div-t">${b.kind==='champions'?'Champions':'Divisions'} <small class="rk-count">${b.divisions.length}</small></h2>
      <div class="rk-grid">${b.divisions.map((x,i)=>divHTML(x,i,b.kind,d)).join('')}</div></section>`;
  main.setAttribute('aria-busy','false');
  document.title=`${d.promotion} ${b.kind==='champions'?'champions':'rankings'} — CageTime`;
  if(sel.value!==d.key)sel.value=d.key;
}
function route(){
  const h=parseHash();
  if(!h&&cur.p&&location.hash.startsWith('#fighter='))return;   // drawer open over the current promotion
  const def=IDX.promotions[0].key;
  let key=h&&IDX.promotions.some(p=>p.key===h.p)?h.p:(cur.p||def);
  if(h&&h.p&&key!==h.p){history.replaceState(null,'','#'+key)}   // unknown promotion in the URL
  const want=h&&h.p===key?h.b:'';
  load(key).then(d=>{
    const b=d.boards.find(x=>x.key===want)||d.boards[0];
    if(cur.p===key&&cur.b===b.key&&main.querySelector('.rk-head'))return;
    render(d,b.key);
  }).catch(err=>{console.error(err);main.innerHTML='<p class="muted">Could not load these rankings. Please refresh.</p>'});
}
Promise.all([CT.getJSON('data/rankings/index.json'),CT.fightersReady.catch(()=>null)]).then(([idx])=>{
  IDX=idx;
  const R=idx.promotions.filter(p=>p.kind==='rankings'),C=idx.promotions.filter(p=>p.kind!=='rankings');
  sel.innerHTML=`<optgroup label="Official rankings">${R.map(p=>`<option value="${esc(p.key)}">${esc(p.promotion)}${p.key==='one'?' (Muay Thai rankings · MMA champions)':p.key==='bkfc'?' (bare knuckle)':''}</option>`).join('')}</optgroup>`+
    (C.length?`<optgroup label="Champions only (no official rankings)">${C.map(p=>`<option value="${esc(p.key)}">${esc(p.promotion)} — champions only</option>`).join('')}</optgroup>`:'');
  $('#rk-upd').textContent=idx.updated||'—';
  sel.onchange=()=>{location.hash='#'+sel.value};
  route();
}).catch(err=>{console.error(err);main.innerHTML='<p class="muted">Could not load rankings data. Please refresh.</p>'});
window.addEventListener('hashchange',()=>{if(IDX)route()});
})();
