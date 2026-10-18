/* CageTime Games — renders the game cards from games.json. To add a game, edit games.json only. */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>(/^https?:\/\//i.test(u||'')||/^[a-z0-9][a-z0-9_\-\/]*\.html(#[\w-]*)?$/i.test(u||''))?u:null;
const grid=document.getElementById('games-grid');
const soon=`<li class="gm-card gm-soon" aria-live="polite"><span class="gm-icon" aria-hidden="true">&#9654;</span>
  <h2>New games dropping soon</h2>
  <p>We're building quick, free games for fight fans. Join the newsletter and we'll tell you the moment the first one goes live.</p>
  <a class="gm-cta" href="./#newsletter">Get notified</a></li>`;
function card(g){
  const url=g.status==='live'?safeUrl(g.url):null;
  const inner=`${g.tag?`<span class="gm-tag">${esc(g.tag)}</span>`:''}<h3>${esc(g.title)}</h3><p>${esc(g.blurb)}</p>`+
    (url?'<span class="gm-go">Play now →</span>':'<span class="gm-go" style="color:var(--dim)">Coming soon</span>');
  const ext=url&&/^https?:/i.test(url)?' target="_blank" rel="noopener"':'';
  return url?`<li><a class="gm-card" href="${esc(url)}"${ext}>${inner}</a></li>`:`<li class="gm-card" aria-disabled="true">${inner}</li>`;
}
function render(list){
  const games=(list||[]).filter(g=>g&&g.id&&g.title);
  grid.innerHTML=games.length?games.map(card).join(''):soon;
  grid.setAttribute('aria-busy','false');
}
fetch('games.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('games.json '+r.status);return r.json()})
  .then(d=>{render(d.games);const u=document.getElementById('gm-upd');if(u&&d.updated)u.textContent=d.updated})
  .catch(()=>render([]));
})();
