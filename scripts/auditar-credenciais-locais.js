// Auditoria somente leitura; nunca utiliza ou imprime uma credencial.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
const raiz=resolve(import.meta.dirname,'..');
const git=process.env.GIT_EXECUTAVEL||'git';
function consultarGit(argumentos){const retorno=spawnSync(git,argumentos,{cwd:raiz,encoding:'utf8',maxBuffer:10*1024*1024});if(retorno.error)throw retorno.error;return retorno;}
const antigas=[];
const arquivosHistoricos=consultarGit(['grep','-I','-l','-E','sk-or-v1-[a-zA-Z0-9_-]{30,}','HEAD']);
if(arquivosHistoricos.status>1)throw new Error('Não foi possível verificar o HEAD local.');
for(const caminho of arquivosHistoricos.stdout.trim().split(/\r?\n/).filter(Boolean).map(caminho=>caminho.replace(/^HEAD:/,''))){
  const retorno=consultarGit(['show','HEAD:'+caminho]);
  if(retorno.status===0)for(const chave of retorno.stdout.match(/sk-or-v1-[a-zA-Z0-9_-]{30,}/g)||[])antigas.push(chave);
}
let ambiente={};
for(const arquivo of ['.env','.env.local'])if(existsSync(resolve(raiz,arquivo)))ambiente={...ambiente,...parseEnv(readFileSync(resolve(raiz,arquivo),'utf8'))};
function verificarPasta(pasta){let antiga=false,atual=false,arquivos=0;
  if(!existsSync(pasta))return {existe:false};
  for(const entrada of readdirSync(pasta,{withFileTypes:true})){const caminho=resolve(pasta,entrada.name);if(entrada.isDirectory()){const dados=verificarPasta(caminho);antiga||=dados.antiga;atual||=dados.atual;arquivos+=dados.arquivos||0;}else if(['.js','.json','.html','.css','.txt'].includes(extname(caminho))){const texto=readFileSync(caminho,'utf8');arquivos++;antiga||=antigas.some(chave=>texto.includes(chave));atual||=Boolean(ambiente.OPENROUTER_API_KEY&&texto.includes(ambiente.OPENROUTER_API_KEY));}}
  return {existe:true,arquivos,antiga,atual};
}
const ledger=resolve(raiz,'evidencias/homologacao-real/controle.json');
const historico=consultarGit(['log','--all','--format=%h','-G','sk-or-v1-']);
const resultado={data:new Date().toISOString(),somenteLeitura:true,chaveAntigaEncontradaNoHead:antigas.length>0,chaveAtualDiferente:Boolean(ambiente.OPENROUTER_API_KEY&&antigas.length&&!antigas.includes(ambiente.OPENROUTER_API_KEY)),artefatos:verificarPasta(resolve(raiz,'www')),legadoNaoPublicado:verificarPasta(resolve(raiz,'web')),commitsComAlteracaoDoPadrao:historico.status===0?[...new Set(historico.stdout.trim().split(/\r?\n/).filter(Boolean))]:null,revogacaoAntiga:'BLOQUEADA POR DEPENDÊNCIA EXTERNA: confirmar no painel, nunca testar a chave antiga',ledgerSha256:existsSync(ledger)?createHash('sha256').update(readFileSync(ledger)).digest('hex'):null};
mkdirSync(resolve(raiz,'evidencias/comercial'),{recursive:true});writeFileSync(resolve(raiz,'evidencias/comercial/credenciais.json'),JSON.stringify(resultado,null,2));
if(resultado.artefatos.antiga||resultado.artefatos.atual)throw new Error('Credencial encontrada nos artefatos públicos.');
console.info(JSON.stringify(resultado,null,2));
