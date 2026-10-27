/* CageTime sitewide promotion preference. Default: UFC only (most visitors only follow the UFC).
   - Stored in localStorage 'ct-promos': 'all' or a JSON array of promotion names, e.g. ["UFC","PFL"]. Nothing is sent anywhere.
   - Lists honor it: events list (app.js), results archive (event.js), rankings default (rankings.js), calendar page.
     Pages about ONE event or result never filter: a direct link always shows its own content.
   - Control: any element with [data-promo-pref] gets a "UFC | All promotions | Choose" toggle (keyboard + screen-reader
     friendly). Any [data-pf-set="all"|"ufc"] button anywhere switches the preference.
   - Change event: window 'ct-promos' (also fired when another tab changes it).
   API: window.CageTimePrefs = {get, set, allows, mode, label, names, keyOf, noteHTML, mount} */
(function(){
'use strict';
const KEY='ct-promos';
const ALL=[['ufc','UFC'],['pfl','PFL'],['one','ONE'],['rizin','RIZIN'],['ksw','KSW'],['oktagon','OKTAGON'],['cw','Cage Warriors'],['bkfc','BKFC'],['lfa','LFA']];
const NAMES=ALL.map(p=>p[1]);
const DEF=['UFC'];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function norm(v){
  if(v==='all')return 'all';
  const a=NAMES.filter(n=>Array.isArray(v)&&v.includes(n));
  if(!a.length)return DEF.slice();
  return a.length===NAMES.length?'all':a;
}
function read(){
  let v=null;try{v=localStorage.getItem(KEY)}catch(_){}
  if(v==null)return DEF.slice();
  if(v==='all')return 'all';
  try{return norm(JSON.parse(v))}catch(_){return DEF.slice()}
}
let cur=read();
const get=()=>cur==='all'?'all':cur.slice();
const allows=name=>cur==='all'||cur.includes(name);
const mode=()=>cur==='all'?'all':(cur.length===1&&cur[0]==='UFC'?'ufc':'custom');
const label=()=>cur==='all'?'All promotions':cur.join(', ');
const keyOf=name=>(ALL.find(p=>p[1]===name)||[null])[0];
function set(v){
  cur=norm(v);
  try{localStorage.setItem(KEY,cur==='all'?'all':JSON.stringify(cur))}catch(_){}
  emit();
}
function emit(){
  mounts.forEach(update);
  try{window.dispatchEvent(new CustomEvent('ct-promos',{detail:{promos:get(),mode:mode()}}))}catch(_){}
}
/* "Showing UFC only · 31 more events from other promotions. [Show all promotions]" (empty string when nothing is hidden) */
function noteHTML(hidden,noun,shown){
  if(!hidden||cur==='all')return '';
  const who=mode()==='ufc'?'UFC':esc(label());
  return `${shown===0?`No ${who} ${esc(noun)} right now. `:`Showing ${who} only. `}${hidden} more ${esc(hidden===1?noun.replace(/s$/,''):noun)} from other promotions. <button type="button" class="pf-link" data-pf-set="all">Show all promotions</button>`;
}

/* ---- the control ---- */
const mounts=[];let uid=0;
function mount(el){
  if(!el||el.dataset.pfReady)return;el.dataset.pfReady='1';
  const id='pf-pick-'+(++uid),lb=el.getAttribute('data-labelledby');
  el.classList.add('pf');
  el.innerHTML=`<div class="pf-seg" role="group" ${lb?`aria-labelledby="${esc(lb)}"`:'aria-label="Promotions to show"'}>
    <button type="button" class="pf-b" data-pf-set="ufc" aria-pressed="false">UFC</button><button type="button" class="pf-b" data-pf-set="all" aria-pressed="false">All promotions</button><button type="button" class="pf-b pf-choose" aria-expanded="false" aria-controls="${id}">Choose<small class="pf-n"></small></button>
  </div>
  <fieldset class="pf-pick" id="${id}" hidden><legend>Show these promotions</legend>${ALL.map(([k,n])=>`<label><input type="checkbox" value="${esc(n)}"> ${esc(n)}</label>`).join('')}<p class="pf-msg" role="status" aria-live="polite"></p></fieldset>`;
  const ch=el.querySelector('.pf-choose'),fs=el.querySelector('.pf-pick');
  ch.addEventListener('click',()=>{const o=fs.hidden;fs.hidden=!o;ch.setAttribute('aria-expanded',String(o));if(o){const f=fs.querySelector('input:checked')||fs.querySelector('input');if(f)f.focus()}});
  fs.addEventListener('change',()=>{
    const picked=[...fs.querySelectorAll('input:checked')].map(i=>i.value),msg=fs.querySelector('.pf-msg');
    if(!picked.length){msg.textContent='Pick at least one promotion.';update(el);return}
    msg.textContent='';set(picked);
  });
  fs.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();fs.hidden=true;ch.setAttribute('aria-expanded','false');ch.focus()}});
  mounts.push(el);update(el);
}
function update(el){
  const m=mode();
  el.querySelectorAll('[data-pf-set]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pfSet===m)));
  const ch=el.querySelector('.pf-choose');
  if(ch){ch.classList.toggle('is-on',m==='custom');
    ch.querySelector('.pf-n').textContent=m==='custom'?' ('+cur.length+')':'';
    ch.setAttribute('aria-label',m==='custom'?'Choose promotions, '+cur.length+' picked: '+label():'Choose promotions')}
  el.querySelectorAll('.pf-pick input').forEach(i=>{i.checked=allows(i.value)});
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-pf-set]');if(!b)return;
  const v=b.dataset.pfSet;set(v==='all'?'all':[v==='ufc'?'UFC':v]);
  if(b.classList.contains('pf-link')){const t=document.querySelector('[data-promo-pref] [data-pf-set="all"]');if(t)t.focus()}
});
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){cur=read();emit()}});
function init(){document.querySelectorAll('[data-promo-pref]').forEach(mount)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.CageTimePrefs={get,set,allows,mode,label,names:NAMES.slice(),keyOf,noteHTML,mount,KEY};
})();
