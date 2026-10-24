import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(raiz,'www/vendor'),{recursive:true});
for(const [origem,destino] of [['node_modules/chart.js/dist/chart.umd.js','chart.js'],['node_modules/lucide/dist/umd/lucide.js','lucide.js']])copyFileSync(resolve(raiz,origem),resolve(raiz,'www/vendor',destino));
for(const peso of [400,500,600,700])copyFileSync(resolve(raiz,'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-'+peso+'-normal.woff2'),resolve(raiz,'www/vendor/space-grotesk-'+peso+'.woff2'));
const avisos=[];
for(const [nome,arquivo] of [['Chart.js','node_modules/chart.js/LICENSE.md'],['Lucide','node_modules/lucide/LICENSE'],['Space Grotesk','node_modules/@fontsource/space-grotesk/LICENSE'],['Dados TACO','LICENCA_TACO.txt']])if(existsSync(resolve(raiz,arquivo)))avisos.push(nome+'\n'+readFileSync(resolve(raiz,arquivo),'utf8'));
writeFileSync(resolve(raiz,'www/LICENCAS.txt'),avisos.join('\n\n'));
const legado=resolve(raiz,'www/js/config.local.js');if(existsSync(legado))unlinkSync(legado);
writeFileSync(resolve(raiz,'www/data/licencas.json'),JSON.stringify(politicaLicencas()));
const arquivosCache=['/index.html','/manifest.json'];
function listarCache(pasta,prefixo){for(const entrada of readdirSync(pasta,{withFileTypes:true})){const caminho=resolve(pasta,entrada.name);if(entrada.isDirectory())listarCache(caminho,prefixo+'/'+entrada.name);else if(!['config.example.js','config.local.js'].includes(entrada.name))arquivosCache.push(prefixo+'/'+entrada.name);}}
for(const pasta of ['js','css','telas','data','icons','vendor'])listarCache(resolve(raiz,'www',pasta),'/'+pasta);
writeFileSync(resolve(raiz,'www/precache.json'),JSON.stringify(arquivosCache));
// Uma versão por conteúdo evita manter JS antigo após uma nova publicação.
const resumo=createHash('sha256');
for(const arquivo of arquivosCache){resumo.update(arquivo);resumo.update(readFileSync(resolve(raiz,'www','.'+arquivo)));}
const caminhoWorker=resolve(raiz,'www/sw.js');
const worker=readFileSync(caminhoWorker,'utf8');
writeFileSync(caminhoWorker,worker.replace(/const VERSAO_CACHE='[^']+';/,"const VERSAO_CACHE='nutrifoto-estatico-"+resumo.digest('hex').slice(0,16)+"';"));
await import('./verificar-seguranca.js');
console.log('Assets locais preparados; nenhuma variável privada foi publicada.');
import { politicaLicencas } from '../servidor/licenca-politica.js';
