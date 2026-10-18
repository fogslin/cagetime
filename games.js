/* CageTime Games: renders the game cards from games.json. To add a game, edit games.json only.
   games.html ships the same cards as static HTML, so the page still works if games.json can't be loaded. */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>(/^https?:\/\//i.test(u||'')||/^[a-z0-9][a-z0-9_\-\/]*\.html(#[\w-]*)?$/i.test(u||''))?u:null;
const grid=document.getElementById('games-grid');
function card(g,i){
  const url=g.status==='live'?safeUrl(g.url):null;
  const inner=`<span class="gm-num" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${g.tag?`<span class="gm-tag">${esc(g.tag)}</span>`:''}<h3>${esc(g.title)}</h3><p>${esc(g.blurb)}</p>`+
    (url?'<span class="gm-go">Play now →</span>':'<span class="gm-go" style="color:var(--dim)">Coming soon</span>');
  const ext=url&&/^https?:/i.test(url)?' target="_blank" rel="noopener"':'';
  const id=esc(String(g.id).replace(/[^\w-]/g,''));
  return url?`<li><a class="gm-card" data-game="${id}" href="${esc(url)}"${ext}>${inner}</a></li>`:`<li class="gm-card" data-game="${id}" aria-disabled="true">${inner}</li>`;
}
function render(list){
  const games=(list||[]).filter(g=>g&&g.id&&g.title);
  if(games.length){grid.innerHTML=games.map(card).join('');grid.setAttribute('data-count',games.length)}
  grid.setAttribute('aria-busy','false');
}
fetch('games.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('games.json '+r.status);return r.json()})
  .then(d=>{render(d.games);const u=document.getElementById('gm-upd');if(u&&d.updated)u.textContent=d.updated})
  .catch(()=>grid.setAttribute('aria-busy','false'));
})();
