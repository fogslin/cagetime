/* CageTime PWA helper: registers the service worker and shows an "Install app" prompt.
   - Chromium/Android: uses the beforeinstallprompt event (button appears only when the browser says the app is installable).
   - iOS Safari: shows "Share → Add to Home Screen" instructions (iOS has no install prompt API).
   - Nothing shows when already installed (display-mode: standalone). Dismissal is remembered for 30 days.
   Service worker: registers /OneSignalSDKWorker.js (the one combined root worker: OneSignal push + sw.js caching) unless
   OneSignal has already registered it. window.CageTimePWA.ready resolves with the ServiceWorkerRegistration. */
(function(){
'use strict';
const ROOT=(()=>{try{return new URL('.',document.currentScript.src)}catch(_){return new URL('/',location.href)}})();
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ua=navigator.userAgent||'';
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isSafari=/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
const KEY='ct-install-dismissed';
const dismissed=()=>{try{return Date.now()-(+localStorage.getItem(KEY)||0)<30*864e5}catch(_){return false}};
let deferred=null;
const ready=('serviceWorker' in navigator)?new Promise((res,rej)=>{
  const scope=new URL('./',ROOT).pathname;
  const go=()=>navigator.serviceWorker.getRegistration(scope).then(r=>{
    const cur=r&&(r.active||r.waiting||r.installing);
    if(cur&&/OneSignalSDKWorker\.js/.test(cur.scriptURL))return r;   /* already ours (maybe registered by OneSignal with its own query string) */
    return navigator.serviceWorker.register(new URL('OneSignalSDKWorker.js',ROOT).href,{scope});
  }).then(res,rej);
  if(document.readyState==='complete')go();else addEventListener('load',go);
}):Promise.reject(new Error('no service worker support'));
ready.catch(()=>{});
function slots(){return [...document.querySelectorAll('[data-install]')]}
function close(){slots().forEach(s=>{s.hidden=true;s.innerHTML=''});try{localStorage.setItem(KEY,String(Date.now()))}catch(_){}}
function show(kind){
  if(standalone())return;
  slots().forEach(s=>{
    const inline=s.hasAttribute('data-install-inline');
    if(!inline&&dismissed())return;
    s.innerHTML=kind==='prompt'
      ?`<div class="inst"><img src="${new URL('icons/icon-192.png',ROOT).href}" alt="" width="36" height="36"><p><b>Install CageTime</b><span>Fight times and cards on your home screen, works offline.</span></p><button type="button" class="btn-sm" data-inst-go>Install app</button>${inline?'':'<button type="button" class="inst-x" aria-label="Dismiss install prompt" data-inst-x>✕</button>'}</div>`
      :`<div class="inst"><img src="${new URL('icons/icon-192.png',ROOT).href}" alt="" width="36" height="36"><p><b>Add CageTime to your Home Screen</b><span>In Safari tap <b>Share</b> <span aria-hidden="true">⎋</span> then <b>Add to Home Screen</b>.</span></p>${inline?'':'<button type="button" class="inst-x" aria-label="Dismiss" data-inst-x>✕</button>'}</div>`;
    s.hidden=false;
  });
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;show('prompt')});
addEventListener('appinstalled',()=>{deferred=null;slots().forEach(s=>{s.hidden=true;s.innerHTML=''})});
document.addEventListener('click',async e=>{
  const go=e.target.closest&&e.target.closest('[data-inst-go]'),x=e.target.closest&&e.target.closest('[data-inst-x]');
  if(x){close();return}
  if(go&&deferred){deferred.prompt();try{await deferred.userChoice}catch(_){}deferred=null;slots().forEach(s=>{s.hidden=true})}
});
function initIOS(){if(isIOS&&isSafari&&!standalone())show('ios')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initIOS);else initIOS();
window.CageTimePWA={ready,standalone,canPrompt:()=>!!deferred};
})();
