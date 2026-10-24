import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';
await import('./preparar-publicacao.js');
const raiz=resolve(import.meta.dirname,'..'),destino=resolve(raiz,'builds/android-web');
if(!destino.startsWith(raiz+sep)||destino!==resolve(raiz,'builds/android-web'))throw new Error('Destino Android inválido.');
if(existsSync(destino)){
  if(!existsSync(resolve(destino,'.nutrifoto-gerado')))throw new Error('Pasta Android não reconhecida como gerada; nenhum arquivo foi removido.');
  rmSync(destino,{recursive:true});
}
mkdirSync(destino,{recursive:true});
cpSync(resolve(raiz,'www'),destino,{recursive:true});
writeFileSync(resolve(destino,'.nutrifoto-gerado'),'assets gerados, sem dados de usuário');
const origem=process.env.NUTRIFOTO_BACKEND_ORIGIN||'';
if(origem){const endereco=new URL(origem);if(endereco.origin!==origem||endereco.protocol!=='https:'||endereco.username||endereco.password)throw new Error('NUTRIFOTO_BACKEND_ORIGIN exige somente uma origem HTTPS pública.');}
await build({entryPoints:[resolve(raiz,'scripts/runtime-android.js')],outfile:resolve(destino,'js/runtime-android.js'),bundle:true,format:'iife',target:'chrome107',minify:true,define:{NUTRIFOTO_BACKEND_ORIGIN:JSON.stringify(origem)},legalComments:'eof'});
const entrada=resolve(destino,'index.html');
writeFileSync(entrada,readFileSync(entrada,'utf8').replace('<script type="module" src="js/app.js"></script>','<script src="js/runtime-android.js"></script><script type="module" src="js/app.js"></script>'));
console.info('Assets Android preparados. Backend '+(origem?'HTTPS configurado.':'não configurado; recursos locais disponíveis.'));
