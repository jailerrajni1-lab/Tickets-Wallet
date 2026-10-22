const V="wallet-v2",SHELL=["./","index.html","manifest.webmanifest","icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="ta-share").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method==="POST"&&u.pathname.endsWith("/share-target")){
    e.respondWith((async()=>{
      try{
        const fd=await r.formData(),files=fd.getAll("ticket").filter(f=>f&&f.size),c=await caches.open("ta-share");
        for(const k of await c.keys())await c.delete(k);
        for(let i=0;i<files.length;i++)await c.put("/shared/"+i,new Response(files[i],{headers:{"content-type":files[i].type||"application/octet-stream","x-name":encodeURIComponent(files[i].name||"ticket")}}));
      }catch(x){}
      return Response.redirect(new URL("./?shared=1",self.registration.scope).href,303);
    })());
    return;
  }
  if(r.method!=="GET")return;
  e.respondWith(fetch(r).then(res=>{if(res.ok&&(u.origin===location.origin||u.hostname==="cdnjs.cloudflare.com")){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match("./"))));
});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window"}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow("./")))});
