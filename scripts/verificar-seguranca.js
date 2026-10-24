import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../www');
const falhas=[];
function verificarArquivos(pasta){for(const entrada of readdirSync(pasta,{withFileTypes:true})){const caminho=resolve(pasta,entrada.name);if(entrada.isDirectory())verificarArquivos(caminho);else if(['.js','.html','.json','.css','.txt'].includes(extname(caminho))){const texto=readFileSync(caminho,'utf8');if(/sk-or-v1-[a-zA-Z0-9_-]{30,}|sk_(?:test|live)_[a-zA-Z0-9]{15,}|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+["']/.test(texto))falhas.push(caminho);if(entrada.name.endsWith('.html')&&/<script[^>]+src=["']https?:/.test(texto))falhas.push(caminho+' (script externo)');}}}
verificarArquivos(raiz);
if(falhas.length)throw new Error('Publicação bloqueada: segredo ou script externo em '+falhas.join(', '));
console.log('Verificação pública: nenhum padrão de segredo ou script externo encontrado.');
