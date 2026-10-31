/* CageTime's ONE root service worker (scope "/"), shared by OneSignal web push and the PWA.
   OneSignal (Typical Site, default dashboard paths) registers /OneSignalSDKWorker.js at scope "/", and pwa.js registers
   this same file, so there is never a second worker competing for the root scope (OneSignal's "combining multiple
   service workers" approach: OneSignal's script + the site's own worker in one file).
   - OneSignal's worker handles push / notification clicks. It is wrapped in try/catch so a blocked or offline CDN
     never breaks the PWA (offline page and caching keep working).
   - sw.js holds the PWA caching logic. Its ?v= changes every release so browsers pick up new versions.
   Keep this file at this URL permanently: push subscribers' browsers fetch it from here. */
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) { /* push unavailable; PWA still works */ }
importScripts('/sw.js?v=20261031a');
