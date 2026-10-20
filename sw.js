/* Wallet service worker: works offline, and picks up new deployments quickly */
const V="wallet-v1";
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
const CDN=["cdnjs.cloudflare.com","cdn.jsdelivr.net","unpkg.com","fonts.googleapis.com","fonts.gstatic.com","tessdata.projectnaptha.com"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});

const net=(r,ms)=>new Promise((res,rej)=>{
  const t=setTimeout(()=>rej(new Error("timeout")),ms);
  fetch(r).then(x=>{clearTimeout(t);res(x)},x=>{clearTimeout(t);rej(x)});
});
const keep=(r,res)=>{
  if(res&&(res.ok||res.type==="opaque")&&res.status!==206){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{})}
  return res;
};

self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    /* network first, so a new deployment shows at once; the cache is the offline fallback */
    e.respondWith(net(r,4000).then(res=>keep(r,res)).catch(()=>
      caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==="navigate"?caches.match("index.html"):Response.error()))));
  }else if(CDN.includes(u.hostname)){
    /* libraries and fonts: cache first, fetched once */
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>keep(r,res))));
  }
});
