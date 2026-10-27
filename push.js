/* CageTime fight alerts (OneSignal Web SDK v16, Typical Site setup). Shared include on every page.
   - Loads OneSignalSDK.page.js and runs OneSignal.init with the public App ID. No REST/API key is ever in the site:
     sending happens server-side later.
   - Never prompts on page load. The "Get fight alerts" button (top bar on every page, plus [data-alerts] buttons on event
     pages) opens a panel; only "Turn on alerts" there asks the browser for permission.
   - Privacy: init uses requiresUserPrivacyConsent, so OneSignal collects nothing until the visitor turns alerts on.
   - Interest tags per promotion: promo_ufc=1, promo_pfl=1 ... (UFC is ticked by default; the other promotions sit
     behind "More promotions", opened automatically when one of them was picked before). Unticked = tag removed.
   - iOS/iPadOS: web push only works from the Home Screen app (iOS 16.4+), so Safari shows that hint instead.
   - The SDK only initialises on https://getcagetime.com (the origin registered in OneSignal); elsewhere (local tests)
     the button still works as UI but says alerts are only available on the live site.
   - Service worker: OneSignal uses /OneSignalSDKWorker.js at scope "/", the same combined worker pwa.js registers. */
(function(){
'use strict';
const APP_ID='ac44214e-01fb-4250-8c06-fab3e7899a9a';
const ORIGIN='https://getcagetime.com';
const PROMOS=[['ufc','UFC'],['pfl','PFL'],['one','ONE'],['rizin','RIZIN'],['ksw','KSW'],['oktagon','OKTAGON'],['cw','Cage Warriors'],['bkfc','BKFC'],['lfa','LFA']];
const KEY='ct-alerts';   /* local copy of the chosen promotions + consent, so the panel shows the state without the SDK */
const live=location.origin===ORIGIN;
const ua=navigator.userAgent||'';
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const supported=('Notification' in window)&&('serviceWorker' in navigator)&&('PushManager' in window);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{return JSON.parse(localStorage.getItem(KEY))||null}catch(_){return null}}
function save(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch(_){}}
const st=load()||{on:false,promos:['ufc']};

/* ---- SDK (exactly OneSignal's v16 snippet, wrapped) ---- */
window.OneSignalDeferred=window.OneSignalDeferred||[];
let sdkReady=null;
if(live){
  const s=document.createElement('script');s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';s.defer=true;s.id='onesignal-sdk';
  document.head.appendChild(s);
  sdkReady=new Promise(res=>{OneSignalDeferred.push(async function(OneSignal){
    await OneSignal.init({appId:APP_ID,requiresUserPrivacyConsent:true});
    if(st.on)await OneSignal.setConsentGiven(true);
    res(OneSignal);
  })});
  sdkReady.catch(()=>{});
}
async function enable(promos){
  if(!live)throw new Error('Alerts can only be switched on at '+ORIGIN+'.');
  if(!supported)throw new Error('This browser does not support web push.');
  const OS=await sdkReady;
  await OS.setConsentGiven(true);
  await OS.Notifications.requestPermission();
  if(!OS.Notifications.permission)throw new Error('Notifications are blocked for this site. Allow them in your browser settings to get alerts.');
  const tags={};PROMOS.forEach(([k])=>{if(promos.includes(k))tags['promo_'+k]='1'});
  await OS.User.addTags(tags);
  const off=PROMOS.map(([k])=>'promo_'+k).filter(t=>!tags[t]);if(off.length)await OS.User.removeTags(off);
  st.on=true;st.promos=promos;save(st);
}
async function disable(){
  if(live&&sdkReady){const OS=await sdkReady;try{await OS.User.PushSubscription.optOut()}catch(_){}}
  st.on=false;save(st);
}

/* ---- UI ---- */
function bell(){return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>'}
function addTopButton(){
  const bar=document.querySelector('.topbar-in');if(!bar||bar.querySelector('.alerts-btn'))return;
  const b=document.createElement('button');b.type='button';b.className='alerts-btn';b.setAttribute('data-alerts','');
  b.setAttribute('aria-label','Get fight alerts');b.innerHTML=bell()+'<span>Alerts</span>';bar.appendChild(b);
}
function box([k,n]){return `<label><input type="checkbox" value="${k}"${st.promos.includes(k)?' checked':''}> ${esc(n)}</label>`}
function panelHTML(msg){
  const ios=isIOS&&!standalone;
  return `<div class="al-in" role="document">
  <button type="button" class="fp-x" data-al-x aria-label="Close">✕</button>
  <p class="eyebrow">Fight alerts</p><h2 id="al-title">Get fight alerts</h2>
  <p class="muted">Pick the promotions you follow. Fight-night alerts are rolling out soon, and you'll be first in line when they go live. You can turn them off here at any time.</p>
  <fieldset class="al-promos"><legend>Promotions</legend>${PROMOS.slice(0,1).map(box).join('')}
    <details class="al-more"${st.promos.some(k=>k!=='ufc')?' open':''}><summary>More promotions</summary><div class="al-more-in">${PROMOS.slice(1).map(box).join('')}</div></details></fieldset>
  ${ios?`<p class="al-ios"><b>iPhone / iPad:</b> notifications only work from the CageTime Home Screen app. In Safari tap <b>Share</b> then <b>Add to Home Screen</b>, open CageTime from your Home Screen and tap Alerts there (iOS 16.4 or later).</p>`:''}
  <p class="al-acts"><button type="button" class="btn-sm" data-al-on${ios||!supported?' disabled':''}>${st.on?'Save alert choices':'Turn on alerts'}</button>${st.on?'<button type="button" class="btn-sm ghost" data-al-off>Turn alerts off</button>':''}</p>
  <p class="al-msg" role="status" aria-live="polite">${esc(msg|| (st.on?'Alerts are on for '+PROMOS.filter(([k])=>st.promos.includes(k)).map(p=>p[1]).join(', ')+'.':(!supported&&!ios?'This browser does not support web push notifications.':'')))}</p>
  <p class="muted small">Alerts are delivered by OneSignal. Nothing is collected until you turn them on; then OneSignal stores your browser's push subscription and the promotions you picked.${live?'':' (Alerts can only be switched on at getcagetime.com.)'}</p>
</div>`;
}
let dlg=null,opener=null;
function open(msg){
  if(!dlg){dlg=document.createElement('dialog');dlg.className='fp al-dlg';dlg.setAttribute('aria-labelledby','al-title');document.body.appendChild(dlg);
    dlg.addEventListener('click',onPanelClick);dlg.addEventListener('cancel',e=>{e.preventDefault();close()});}
  dlg.innerHTML=panelHTML(msg);
  if(!dlg.open){opener=document.activeElement;try{dlg.showModal()}catch(_){dlg.setAttribute('open','')}}
}
function close(){if(dlg&&dlg.open)dlg.close();if(opener&&document.contains(opener))opener.focus()}
function chosen(){return [...dlg.querySelectorAll('.al-promos input:checked')].map(i=>i.value)}
async function onPanelClick(e){
  if(e.target===dlg||e.target.closest('[data-al-x]')){close();return}
  const on=e.target.closest('[data-al-on]'),off=e.target.closest('[data-al-off]');
  const msg=dlg.querySelector('.al-msg');
  if(on){const p=chosen();if(!p.length){msg.textContent='Pick at least one promotion.';return}
    on.disabled=true;msg.textContent='Asking your browser for permission…';
    try{await enable(p);open('Alerts are on for '+PROMOS.filter(([k])=>p.includes(k)).map(x=>x[1]).join(', ')+'.');refresh()}
    catch(err){on.disabled=false;msg.textContent=err&&err.message?err.message:'Could not turn on alerts.'}}
  if(off){await disable();open('Alerts are off.');refresh()}
}
function refresh(){document.querySelectorAll('.alerts-btn').forEach(b=>b.classList.toggle('is-on',!!st.on))}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-alerts]');if(b&&!(dlg&&dlg.contains(b))){e.preventDefault();open()}});
function init(){addTopButton();refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.CageTimePush={live,supported,ready:sdkReady,open,promos:PROMOS.map(p=>p[0]),state:()=>({...st})};
})();
