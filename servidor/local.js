import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { criarAplicacao } from './aplicacao.js';
import { criarSimulador } from './simulador.js';
import { obterConfiguracao } from './seguranca.js';
import { criarManutencao } from './manutencao.js';
import { criarSaude, criarOperacao } from './operacao.js';

const argumentos = process.argv.slice(2);
const indicePorta = argumentos.indexOf('--porta');
const porta = Number(indicePorta >= 0 ? argumentos[indicePorta + 1] : process.env.PORT || 4173);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error('Porta inválida.');
const simulado = argumentos.includes('--simulado');
if (simulado && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) throw new Error('Simulação proibida em produção.');
const ambiente = { ...process.env, ...(simulado ? { NUTRIFOTO_SIMULADO: 'true', APP_ORIGIN: `http://127.0.0.1:${porta}`, IA_QUOTA_GRATIS: '50' } : {}) };
obterConfiguracao(ambiente);
const arquivo = process.env.NUTRIFOTO_FIXTURES || resolve(tmpdir(), `nutrifoto-simulado-${porta}.json`);
const repositorio = simulado ? criarSimulador(arquivo) : undefined;
const atenderApi = criarAplicacao({ ambiente, repositorio });
const atenderManutencao = criarManutencao({ ambiente, repositorio });
const atenderSaude = criarSaude();
const atenderOperacao = criarOperacao({ ambiente, repositorio });
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../www');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2' };
createServer(async function atenderLocal(requisicao, resposta) {
  if (requisicao.url.split('?')[0] === '/api/saude') return atenderSaude(requisicao, resposta);
  if (requisicao.url.split('?')[0] === '/api/operacao') return atenderOperacao(requisicao, resposta);
  if (requisicao.url.split('?')[0] === '/api/manutencao') return atenderManutencao(requisicao, resposta);
  if (requisicao.url.split('?')[0].startsWith('/api/')) return atenderApi(requisicao, resposta);
  try {
    if (!['GET', 'HEAD'].includes(requisicao.method)) { resposta.writeHead(405); resposta.end(); return; }
    const caminho = decodeURIComponent(new URL(requisicao.url, ambiente.APP_ORIGIN).pathname);
    const arquivoEstatico = resolve(raiz, `.${caminho === '/' ? '/index.html' : caminho}`);
    if (!arquivoEstatico.startsWith(raiz + sep) || !tipos[extname(arquivoEstatico)] || /(?:^|[\\/])\.|config\.local/.test(caminho)) { resposta.writeHead(404); resposta.end(); return; }
    const conteudo = await readFile(arquivoEstatico);
    resposta.setHeader('Content-Type', tipos[extname(arquivoEstatico)]);
    resposta.setHeader('Cache-Control', 'no-store');
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader('Referrer-Policy', 'no-referrer');
    resposta.setHeader('X-Frame-Options', 'DENY');
    resposta.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    resposta.end(requisicao.method === 'HEAD' ? undefined : conteudo);
  } catch { resposta.writeHead(404); resposta.end('Página não encontrada.'); }
}).listen(porta, '127.0.0.1', () => {
  console.info(JSON.stringify({ evento: 'servidor_local', origem: ambiente.APP_ORIGIN, simulado, ...(simulado ? { aviso: 'DADOS E IA FICTÍCIOS. NÃO UTILIZAR PARA ALIMENTAÇÃO REAL.', arquivoFixtures: arquivo } : {}) }));
});
