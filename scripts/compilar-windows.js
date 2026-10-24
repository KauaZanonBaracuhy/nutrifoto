import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'electron-builder';
await import('./preparar-publicacao.js');
const raiz = resolve(import.meta.dirname, '..');
const destino = resolve(raiz, 'builds/windows-app');
const saida = resolve(raiz, 'builds/windows-release');
if (!destino.startsWith(raiz + sep) || destino !== resolve(raiz, 'builds/windows-app')) throw new Error('Destino Windows invalido.');
if (existsSync(destino) && !existsSync(resolve(destino, '.nutrifoto-gerado'))) throw new Error('Pasta Windows nao reconhecida; nenhum arquivo foi alterado.');
if (existsSync(destino)) rmSync(destino, { recursive:true });
mkdirSync(destino, { recursive:true });
writeFileSync(resolve(destino, '.nutrifoto-gerado'), 'Pacote Windows gerado, sem dados do usuario.');
cpSync(resolve(raiz, 'www'), resolve(destino, 'www'), { recursive:true });
cpSync(resolve(raiz, 'desktop'), resolve(destino, 'desktop'), { recursive:true });
const pacote = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8'));
writeFileSync(resolve(destino, 'package.json'), JSON.stringify({ name:'nutrifoto-teste', version:pacote.version, description:'NutriFoto para teste local no Windows', author:'NutriFoto', main:'desktop/principal.cjs' }));
await build({ config:{
  appId:'com.nutrifoto.teste.windows', productName:'NutriFotoTeste', electronVersion:pacote.devDependencies.electron,
  directories:{ app:destino, output:saida }, files:['desktop/**','www/**','package.json','!node_modules{,/**/*}'],
  asar:true, npmRebuild:false, artifactName:'NutriFoto-Teste-${version}-Windows-x64.${ext}',
  win:{ target:[{ target:'portable', arch:['x64'] }], signAndEditExecutable:false },
  portable:{ requestExecutionLevel:'user' },
} });
const arquivos = readdirSync(saida).filter(nome => nome.endsWith('.exe'));
writeFileSync(resolve(saida, 'SHA256SUMS.txt'), arquivos.map(nome => createHash('sha256').update(readFileSync(resolve(saida,nome))).digest('hex') + '  ' + nome).join('\n') + '\n');
console.info('Executavel portatil gerado em ' + saida);
