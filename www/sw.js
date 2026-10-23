const VERSAO_CACHE='nutrifoto-estatico-b6075cc6808b9ff0';
self.addEventListener('install',evento=>{evento.waitUntil(fetch('/precache.json').then(resposta=>resposta.json()).then(arquivos=>caches.open(VERSAO_CACHE).then(cache=>cache.addAll(arquivos))));});
self.addEventListener('activate',evento=>{evento.waitUntil(caches.keys().then(chaves=>Promise.all(chaves.filter(chave=>chave.startsWith('nutrifoto-estatico-')&&chave!==VERSAO_CACHE).map(chave=>caches.delete(chave)))));});
// A atualização só substitui uma versão aberta após ação explícita do usuário.
self.addEventListener('message',evento=>{if(evento.data==='ATUALIZAR')self.skipWaiting();});
self.addEventListener('fetch',evento=>{
  const pedido=evento.request,endereco=new URL(pedido.url);
  if(pedido.method!=='GET'||endereco.origin!==self.location.origin||endereco.pathname.startsWith('/api/'))return;
  // A revisão aberta permanece consistente até o usuário aplicar a atualização.
  evento.respondWith(caches.open(VERSAO_CACHE).then(async cache=>{
    const armazenado=await cache.match(pedido.mode==='navigate'?'/index.html':pedido);
    return armazenado||fetch(pedido);
  }));
});
