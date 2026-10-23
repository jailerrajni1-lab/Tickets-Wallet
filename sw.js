/* Wallet service worker: everything needed to read and save tickets and ID cards works without internet
   once the app has been opened online one time. */
const V="wallet-v6",LIBC="wallet-libs-v1";
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png"];
/* Same SIMD test the scanner uses, so we keep the same engine file it will ask for */
const SIMD=(()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]))}catch(e){return false}})();
const LIBS=[
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.1/dist/worker.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.1/"+(SIMD?"tesseract-core-simd-lstm.wasm.js":"tesseract-core-lstm.wasm.js")
];
const CDN=["cdnjs.cloudflare.com","cdn.jsdelivr.net","fonts.gstatic.com"];
const cors=u=>new Request(u,{mode:"cors",credentials:"omit"});

self.addEventListener("install",e=>{e.waitUntil(Promise.all([
  /* app files: one missing icon must not stop the install (that would also break the Share menu) */
  caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})))),
  /* readers: reuse a copy an older version already saved, else download it */
  caches.open(LIBC).then(c=>Promise.all(LIBS.map(async u=>{
    if(await c.match(u))return;
    const old=await caches.match(u,{ignoreVary:true});
    if(old&&old.ok)return c.put(u,old);
    return c.add(cors(u)).catch(()=>{});
  })))
]).then(()=>self.skipWaiting()))});

self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>![V,LIBC,"ta-share"].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

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
  if(u.origin===location.origin)return r.mode==="navigate"?page(e,r):swr(e,r,V);
  /* scanner language data: the scanner keeps its own copy, no need for a second one */
  if(u.hostname==="cdn.jsdelivr.net"&&u.pathname.startsWith("/npm/@tesseract.js-data/"))return;
  if(CDN.includes(u.hostname))return lib(e,r);
  if(u.hostname==="fonts.googleapis.com")return swr(e,r,LIBC,()=>new Response("",{headers:{"content-type":"text/css"}}));
});

/* The app page: fresh from the network when it answers within 3 s, else the saved copy.
   A weak signal no longer leaves the app stuck on a blank screen, and a server error page
   (404, 500…) never replaces the working saved copy. */
function page(e,r){
  const key=new URL(r.url);key.search="";
  const net=fetch(r);
  e.waitUntil(net.then(res=>{if(!(res.ok&&res.type==="basic"))return;const cp=res.clone();return caches.open(V).then(c=>c.put(key.href,cp))}).catch(()=>{}));
  const saved=async()=>{const c=await caches.open(V);return (await c.match(key.href))||(await c.match("./"))||(await c.match("index.html"))};
  e.respondWith((async()=>{
    try{
      const res=await Promise.race([net,new Promise((_,j)=>setTimeout(()=>j(new Error("slow")),3000))]);
      return res.status>=400?((await saved())||res):res;
    }
    catch(x){return (await saved())||net}
  })());
}
/* Versioned library files never change: use the saved copy, download only when missing */
function lib(e,r){
  e.respondWith((async()=>{
    const hit=await caches.match(r.url,{ignoreVary:true});
    if(hit)return hit;
    let res;
    try{res=await fetch(cors(r.url))}catch(x){return fetch(r)}
    if(res.ok){const cp=res.clone();e.waitUntil(caches.open(LIBC).then(c=>c.put(r.url,cp)))}
    return res;
  })());
}
/* Icons, manifest, font CSS: answer from the saved copy at once, refresh it in the background */
function swr(e,r,name,fb){
  const net=fetch(r);
  e.waitUntil(net.then(res=>{if(!res.ok)return;const cp=res.clone();return caches.open(name).then(c=>c.put(r,cp))}).catch(()=>{}));
  e.respondWith(caches.match(r,{ignoreVary:true}).then(hit=>hit||net.catch(()=>caches.match(r,{ignoreSearch:true,ignoreVary:true}).then(m=>m||(fb?fb():Response.error())))));
}
