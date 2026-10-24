import { mkdtempSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const raiz=resolve(import.meta.dirname,'..'),destino=mkdtempSync(join(tmpdir(),'nutrifoto-fonte-'));
const itens=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','www','servidor','api','scripts','supabase','testes','cloudflare','wrangler.jsonc','LICENCA_TACO.txt'];
for(const item of itens)cpSync(join(raiz,item),join(destino,item),{recursive:true,filter:caminho=>!['vendor','evidencias','precache.json','config.local.js'].includes(basename(caminho))});
if(existsSync(join(destino,'.env')))throw new Error('Arquivo privado não pode estar na cópia de validação.');
const gerenciador=process.env.PNPM_EXECUTAVEL || (process.platform==='win32'?'pnpm.cmd':'pnpm');
const etapas=[];
function executarEtapa(nome,programa,argumentos){const retorno=spawnSync(programa,argumentos,{cwd:destino,encoding:'utf8',shell:process.platform==='win32'&&programa.endsWith('.cmd')});etapas.push({nome,codigo:retorno.status,saida:(retorno.stdout||'')+(retorno.stderr||'')});if(retorno.error||retorno.status)throw new Error(nome+' falhou: '+(retorno.error?.message||retorno.stderr||retorno.stdout));}
try{executarEtapa('instalacao-frozen',gerenciador,['install','--frozen-lockfile',...(process.argv.includes('--offline')?['--offline']:[]),'--ignore-scripts']);executarEtapa('build',process.execPath,['scripts/preparar-publicacao.js']);executarEtapa('sintaxe',process.execPath,['scripts/verificar-sintaxe.js']);console.log('Instalação e build reproduzidos em diretório novo, sem .env ou node_modules anteriores.');}
finally{mkdirSync(join(raiz,'evidencias'),{recursive:true});writeFileSync(join(raiz,'evidencias/fonte-limpa.json'),JSON.stringify({destino,etapas,nota:'Cópia controlada da fonte atual, não um commit/clone publicado.'},null,2));}
