import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname,resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarAplicacao } from '../../servidor/aplicacao.js';
const arquivo=process.argv[2],configuracao=JSON.parse(await readFile(arquivo,'utf8'));
for(const endereco of [configuracao.origemSupabase,configuracao.ambiente.APP_ORIGIN,configuracao.ambiente.SUPABASE_URL])if(new URL(endereco).hostname!=='127.0.0.1')throw new Error('Servidor de teste aceita somente loopback.');
const pasta=dirname(arquivo),tls={key:await readFile(resolve(pasta,'key.pem')),cert:await readFile(resolve(pasta,'cert.pem'))};
const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../../www');
const tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const atender=criarAplicacao({ambiente:configuracao.ambiente,registrar:()=>{},executarModelo:async()=>{throw new Error('IA externa proibida nesta homologação.');}});
const proxy=createServer(tls,(pedido,resposta)=>{
 const destino=new URL(pedido.url,configuracao.origemSupabase);
 if(destino.origin!==configuracao.origemSupabase){resposta.writeHead(403).end();return;}
 const transporte=request(destino,{method:pedido.method,headers:{...pedido.headers,host:destino.host}},recebido=>{resposta.writeHead(recebido.statusCode,recebido.headers);recebido.pipe(resposta);});
 transporte.on('error',()=>resposta.writeHead(502).end());pedido.pipe(transporte);
});
const servidor=createServer(tls,async(pedido,resposta)=>{
 if(pedido.url.startsWith('/api/'))return atender(pedido,resposta);
 try{
  const caminho=decodeURIComponent(new URL(pedido.url,configuracao.ambiente.APP_ORIGIN).pathname),arquivoEstatico=resolve(raiz,'.'+(caminho==='/'?'/index.html':caminho));
  if(!arquivoEstatico.startsWith(raiz+sep)||!tipos[extname(arquivoEstatico)]||/(?:^|[\\/])\.|config\.local/.test(caminho)){resposta.writeHead(404).end();return;}
  resposta.setHeader('Content-Type',tipos[extname(arquivoEstatico)]);resposta.setHeader('Cache-Control','no-store');resposta.end(await readFile(arquivoEstatico));
 }catch{resposta.writeHead(404).end();}
});
await Promise.all([new Promise(resolver=>proxy.listen(new URL(configuracao.ambiente.SUPABASE_URL).port,'127.0.0.1',resolver)),new Promise(resolver=>servidor.listen(new URL(configuracao.ambiente.APP_ORIGIN).port,'127.0.0.1',resolver))]);
if(process.send)process.send({pronto:true});
async function encerrar(){await Promise.all([new Promise(resolver=>servidor.close(resolver)),new Promise(resolver=>proxy.close(resolver))]);process.exit(0);}
process.on('SIGTERM',encerrar);process.on('message',mensagem=>{if(mensagem==='encerrar')encerrar();});
