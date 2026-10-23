import { criarApiWorker } from './adaptador.js';
import pacote from '../package.json' with {type:'json'};

const politica="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const rotas=new Set(['/api/saude','/api/versao','/api/licenca','/api/asaas-webhook','/api/conta','/api/dados','/api/imagens','/api/ia','/api/assinatura','/api/webhook','/api/operacao','/api/manutencao']);
export default {
  async fetch(requisicao,ambiente){
    const endereco=new URL(requisicao.url);let resposta;
    try{
      if(endereco.pathname.startsWith('/api/')&&!rotas.has(endereco.pathname))resposta=Response.json({erro:'Endpoint não encontrado.'},{status:404,headers:{'Cache-Control':'no-store'}});
      else if(endereco.pathname==='/api/versao')resposta=Response.json(['GET','HEAD'].includes(requisicao.method)?{versao:pacote.version,plataforma:'cloudflare-workers',sandbox:true}:{erro:'Método não permitido.'},{status:['GET','HEAD'].includes(requisicao.method)?200:405,headers:{'Cache-Control':'no-store'}});
      else if(endereco.pathname==='/api/asaas-webhook'&&requisicao.method!=='POST')resposta=Response.json({erro:'Método não permitido.'},{status:405,headers:{'Cache-Control':'no-store'}});
      else if(endereco.pathname.startsWith('/api/'))resposta=await criarApiWorker({...ambiente,APP_ORIGIN:endereco.origin===ambiente.PREVIEW_ORIGIN?ambiente.PREVIEW_ORIGIN:ambiente.APP_ORIGIN})(requisicao);
      else if(!['GET','HEAD'].includes(requisicao.method))resposta=new Response(null,{status:405});
      else resposta=await ambiente.ASSETS.fetch(endereco.pathname==='/'?new Request(new URL('/index.html',endereco),requisicao):requisicao);
    }catch{resposta=Response.json({erro:'Serviço temporariamente indisponível. Tente novamente.'},{status:503,headers:{'Cache-Control':'no-store'}});}
    const headers=new Headers(resposta.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',politica);
    if(endereco.pathname==='/sw.js'||endereco.pathname==='/precache.json'||endereco.pathname==='/index.html'||endereco.pathname==='/')headers.set('Cache-Control','no-cache');
    return new Response(requisicao.method==='HEAD'?null:resposta.body,{status:resposta.status,headers});
  }
};
