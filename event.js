/* CageTime static event / results pages: local time conversion, your-country highlight, results filter,
   and fighter profiles (app.js is loaded on the first profile click, so the page itself stays light). */
(function(){
'use strict';
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(_){return '/'}})();
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const fDT=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
function rel(ms){const m=Math.round(ms/6e4),h=Math.round(ms/36e5),d=Math.round(ms/864e5);
  if(Math.abs(m)<60)return m>=0?`in ${m} min`:`${-m} min ago`;if(Math.abs(h)<36)return h>=0?`in ${h} h`:`${-h} h ago`;return d>=0?`in ${d} days`:`${-d} days ago`}
document.querySelectorAll('time[data-local]').forEach(t=>{const d=new Date(t.getAttribute('datetime'));if(!isNaN(d))t.textContent=fDT.format(d)});
document.querySelectorAll('[data-rel]').forEach(s=>{const d=new Date(s.dataset.rel);if(!isNaN(d))s.textContent='· '+rel(d-Date.now())});
const tl=document.querySelector('[data-tzline]');if(tl)tl.textContent='Big times are in your time zone ('+tz+'). Fixed times below for ET, UK and Sydney.';
/* where-to-watch: highlight the visitor's country (same choice as the home page) */
const guess={US:/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise)/,CA:/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina|St_Johns)/,UK:/^Europe\/London/,IE:/^Europe\/Dublin/,AU:/^Australia\//,IN:/^Asia\/(Kolkata|Calcutta)/,DE:/^Europe\/Berlin/,BR:/^America\/(Sao_Paulo|Fortaleza|Recife|Manaus|Bahia|Belem)/};
let cc=null;try{cc=localStorage.ct}catch(_){}
if(!cc)cc=Object.keys(guess).find(k=>guess[k].test(tz))||null;
const row=cc&&document.querySelector('.watch-table tr[data-cc="'+cc+'"]');
if(row){row.classList.add('is-you');row.querySelector('th').insertAdjacentHTML('beforeend',' <small class="you">your country</small>');row.parentNode.prepend(row)}
/* results archive filter */
const sel=document.getElementById('res-promo');
if(sel)sel.onchange=()=>{const v=sel.value;document.querySelectorAll('.res-item').forEach(li=>{li.hidden=!!v&&li.dataset.promo!==v});
  document.querySelectorAll('.res-list').forEach(ol=>{const any=[...ol.children].some(li=>!li.hidden);ol.hidden=!any;const h=ol.previousElementSibling;if(h&&h.tagName==='H2')h.hidden=!any})};
/* fighter profiles: load app.js on demand */
let loading=null;
function loadApp(){if(window.CageTime)return Promise.resolve(window.CageTime);
  if(!loading)loading=new Promise((res,rej)=>{const s=document.createElement('script');
    const v=[...document.scripts].map(x=>x.src).find(x=>/event\.js\?v=/.test(x));s.src=ROOT+'app.js'+(v?'?v='+v.split('?v=')[1]:'');
    s.onload=()=>res(window.CageTime);s.onerror=rej;document.head.appendChild(s)});
  return loading.then(ct=>ct.fightersReady.then(()=>ct))}
document.addEventListener('click',ev=>{
  if(window.CageTime)return;
  const a=ev.target.closest&&ev.target.closest('a[data-fid]');if(!a||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button)return;
  ev.preventDefault();a.setAttribute('aria-busy','true');
  loadApp().then(ct=>{a.removeAttribute('aria-busy');ct.openProfile(a.dataset.fid)}).catch(()=>{location.href=a.href});
});
if(/^#fighter=/.test(location.hash))loadApp().then(ct=>ct.routeHash()).catch(()=>{});
})();
