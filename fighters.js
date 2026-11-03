/* CageTime fighter directory (/fighters/, built by build_fighter_pages.py). The HTML lists every fighter (crawlers and
   no-JS visitors see all of them); this only filters: promotion = sitewide preference (prefs.js, UFC only by default;
   fighters outside the 9 covered promotions show with "All promotions"), division select, name search. */
(function(){
'use strict';
const items=[...document.querySelectorAll('.fd-list li[data-promo]')];
const div=document.getElementById('fd-div'),q=document.getElementById('fd-q'),cnt=document.getElementById('fd-count'),note=document.querySelector('[data-pf-note]');
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase();
items.forEach(li=>{li._k=norm(li.textContent)});
const P=()=>window.CageTimePrefs||{allows:()=>true,mode:()=>'all',noteHTML:()=>''};
function apply(){
  const p=P(),all=p.mode()==='all',d=div?div.value:'',t=norm(q?q.value:'').split(/\s+/).filter(Boolean);
  let shown=0,hidPromo=0;
  items.forEach(li=>{
    const okP=all||(li.dataset.promo!=='Other'&&p.allows(li.dataset.promo));
    const okRest=(!d||li.dataset.div===d)&&t.every(w=>li._k.includes(w));
    if(!okP&&okRest)hidPromo++;
    li.hidden=!(okP&&okRest);if(!li.hidden)shown++;
  });
  document.querySelectorAll('.fd-letter').forEach(s=>{s.hidden=![...s.querySelectorAll('li')].some(li=>!li.hidden)});
  document.querySelectorAll('.fd-jump a').forEach(a=>{const s=document.querySelector(a.getAttribute('href'));a.classList.toggle('is-off',!s||s.hidden)});
  if(cnt)cnt.textContent=shown+' fighter'+(shown===1?'':'s')+(shown<items.length?' of '+items.length:'');
  if(note){const h=p.noteHTML(hidPromo,'fighters',shown);note.innerHTML=h;note.hidden=!h}
}
if(div)div.addEventListener('change',apply);
if(q)q.addEventListener('input',apply);
window.addEventListener('ct-promos',apply);
apply();
})();
