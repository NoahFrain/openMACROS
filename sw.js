const V='openmacros-v2-2',FILES=['./','index.html','app.js','core.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','vendor/html5-qrcode.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Same-origin app shell: network-first with a short timeout so weak signal doesn't stall launch;
// the network fetch keeps running and refreshes the cache. Cross-origin API requests pass straight through.
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const cached=await caches.match(e.request,{ignoreSearch:true});
    const net=fetch(e.request).then(r=>{if(r&&r.ok&&r.type==='basic'){const c=r.clone();caches.open(V).then(ch=>ch.put(e.request,c))}return r});
    try{
      return await (cached?Promise.race([net,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),2500))]):net);
    }catch(err){
      return cached||(await caches.match('index.html'))||Response.error();
    }
  })());
});
