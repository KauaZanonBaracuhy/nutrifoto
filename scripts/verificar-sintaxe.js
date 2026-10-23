import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
let quantidade=0;
function verificarPasta(pasta){for(const entrada of readdirSync(pasta,{withFileTypes:true})){const caminho=resolve(pasta,entrada.name);if(entrada.isDirectory())verificarPasta(caminho);else if(/\.(js|cjs)$/.test(entrada.name)){const retorno=spawnSync(process.execPath,['--check',caminho],{stdio:'inherit'});if(retorno.status)process.exit(retorno.status);quantidade++;}}}
for(const pasta of ['www/js','servidor','api','scripts','testes'])verificarPasta(pasta);
console.log(quantidade+' arquivos passaram na verificação sintática.');
