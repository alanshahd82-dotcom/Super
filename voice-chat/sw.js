const CACHE='voice-chat-v20';
const ASSETS=[
  './',
  './index.html',
  './app.js',
  './agent.js',
  './bridge.js',
  './bridge-endpoint.json',
  './PROJECT_CONTEXT.md',
  './PROJECT_MEMORY.json',
  './tools/registry.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/bridge-endpoint.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }
  event.respondWith(
    fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      return response;
    }).catch(()=>caches.match(event.request))
  );
});