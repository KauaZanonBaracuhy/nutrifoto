// Exclusivo do servidor Node em loopback; não representa licença Android ou pagamento.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { criarToken, resumir, compararSegredo, lerCookies, lerCorpo, falhar, buscarJson } from './seguranca.js';
import { validarPedidoIA, executarIA } from './ia.js';
import { politicaLicencas } from './licenca-politica.js';
import { prepararPremium, executarPremium } from './premium-local.js';
import { criarGroq } from './groq.js';

export function criarDemonstracao({ origem, ambiente, pasta = join(homedir(), '.nutrifoto', 'demonstracao-web'), transporte = buscarJson, enviarGroq = fetch }) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origem) || ambiente.CI_PRODUCAO || ambiente.VERCEL || ambiente.NODE_ENV === 'production') throw new Error('Demonstração restrita ao Node local.');
  mkdirSync(pasta, { recursive: true });
  const provedor = ambiente.IA_PROVEDOR || 'openrouter';
  if (!['groq','openrouter'].includes(provedor)) throw new Error('Provedor de IA não reconhecido.');
  const usaGroq = provedor === 'groq';
  const banco = new DatabaseSync(join(pasta, usaGroq ? 'groq.sqlite' : 'operacoes.sqlite'));
  banco.exec('CREATE TABLE IF NOT EXISTS operacoes (chave TEXT PRIMARY KEY, hash TEXT NOT NULL, estado TEXT NOT NULL, resultado TEXT);');
  banco.exec('CREATE TABLE IF NOT EXISTS diagnosticos (tipo TEXT, erro TEXT, resposta TEXT);');
  if (!banco.prepare('PRAGMA table_info(diagnosticos)').all().some(c=>c.name==='uso')) banco.exec('ALTER TABLE diagnosticos ADD COLUMN uso TEXT');
  let groq;
  if (usaGroq) {
    banco.exec('CREATE TABLE IF NOT EXISTS controle(chave TEXT PRIMARY KEY,valor INTEGER); CREATE TABLE IF NOT EXISTS groq_reservas(chave TEXT PRIMARY KEY,instante INTEGER,modelo TEXT); CREATE TABLE IF NOT EXISTS groq_eventos(id INTEGER PRIMARY KEY,status INTEGER,modelo TEXT,limites TEXT,uso TEXT,instante INTEGER);');
    groq=criarGroq(ambiente,{
      enviar:enviarGroq,
      lerPausa:()=>banco.prepare("SELECT valor FROM controle WHERE chave='pausa'").get()?.valor||0,
      gravarPausa:valor=>banco.prepare("INSERT INTO controle VALUES ('pausa',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").run(valor),
      registrar:e=>banco.prepare('INSERT INTO groq_eventos(status,modelo,limites,uso,instante) VALUES (?,?,?,?,?)').run(e.status,e.modelo||null,JSON.stringify(e.limites||null),JSON.stringify(e.uso||null),Date.now())
    });
  }
  const sessao = criarToken(), csrf = criarToken();
  const premium = ambiente.NUTRIFOTO_PREMIUM_LOCAL === 'true';
  const licencaLocal = premium ? { ativa:true, plano:'completo', origem:'demonstracao_local', nome:'Plano Premium — Demonstração Local', modulos:['foto','texto','plano','metas','resumo'] } : null;
  const configuracao = { origem, simulado: false, ambiente: { ...ambiente, IA_MAX_TOKENS_ANALISE: '1500', IA_PRECO_MAX_ENTRADA_USD_MILHAO: '0.15', IA_PRECO_MAX_SAIDA_USD_MILHAO: '0.6' } };
  configuracao.registrarDiagnostico=(tipo,erro,resposta,uso)=>banco.prepare('INSERT INTO diagnosticos(tipo,erro,resposta,uso) VALUES (?,?,?,?)').run(tipo,erro,resposta||'',JSON.stringify(uso||null));
  return async (req, res) => {
    let operacaoGroq;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.headers.host !== new URL(origem).host || req.headers['sec-fetch-site'] === 'cross-site') falhar(403, 'Origem local não autorizada.');
      const rota = req.url.split('?')[0];
      if (rota === '/api/conta' && req.method === 'GET') {
        res.setHeader('Set-Cookie', `nf_demo=${sessao}; Path=/; HttpOnly; SameSite=Strict`);
        res.end(JSON.stringify({ usuario: null, csrf, iaLocal: true, iaProvedor:provedor, premiumLocal:premium, licencaLocal, simulado: false, planosDisponiveis: premium }));return;
      }
      if (rota === '/api/licenca' && req.method === 'GET') { res.end(JSON.stringify({ planos: politicaLicencas(), sandbox: true, licencaLocal }));return; }
      if (rota !== '/api/ia') falhar(503, 'Este recurso exige backend, banco e configuração próprios. A demonstração local não concede licença Android nem cria Pix.');
      if (req.method !== 'POST') falhar(405, 'Método não permitido.');
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) falhar(415, 'Envie JSON.');
      if (req.headers.origin !== origem || !compararSegredo(lerCookies(req).nf_demo, sessao) || !compararSegredo(req.headers['x-csrf-token'], csrf)) falhar(403, 'Atualize a página para autorizar esta sessão local.');
      if (req.headers['x-ciencia-ia'] !== '1') falhar(403, 'Confirme o envio à IA na área de privacidade.');
      const pedido = await lerCorpo(req, 2800000);
      const sugestao = ['plano','metas','resumo'].includes(pedido.tipo);
      if (sugestao) {if(!premium)falhar(403,'Sugestões Premium exigem o modo local explícito.');prepararPremium(pedido);} else validarPedidoIA(pedido, configuracao);
      if (usaGroq) await groq.preparar();
      else if (!ambiente.OPENROUTER_API_KEY) falhar(503, 'Chave de IA ausente no servidor local.');
      const chave = req.headers['x-idempotency-key'];
      if (typeof chave !== 'string' || !/^[a-f0-9-]{36}$/i.test(chave)) falhar(400, 'Identificador de análise inválido.');
      if(usaGroq)operacaoGroq=chave;
      const hash = resumir(JSON.stringify(pedido)+(sugestao||pedido.tipo==='texto'?'premium-v1':'')+(usaGroq?':groq:'+groq.obterModelo():''));
      banco.exec('BEGIN IMMEDIATE');
      try {
        const anterior = banco.prepare('SELECT * FROM operacoes WHERE chave=?').get(chave);
        let repetirLimitada=false;
        if (anterior) {
          if (anterior.hash !== hash) falhar(409, 'Esta intenção pertence a outra análise.');
          if(usaGroq&&anterior.estado==='limitada')repetirLimitada=true;
          else {
          if (!anterior.resultado) falhar(409, 'Análise já enviada ou incerta. Não repita com uma nova chave; consulte o responsável.');
          banco.exec('COMMIT');const dados=JSON.parse(anterior.resultado);dados.recuperadoLocal=true;res.end(JSON.stringify(dados));return;
          }
        }
        const recuperada = banco.prepare('SELECT resultado FROM operacoes WHERE hash=? AND resultado IS NOT NULL LIMIT 1').get(hash);
        if (recuperada) {
          banco.exec('COMMIT');
          const dados = JSON.parse(recuperada.resultado);
          dados.recuperadoLocal = true;
          dados.avisos = [...(dados.avisos || []), 'Análise real anterior recuperada do servidor local. Nenhuma nova chamada de IA foi realizada.'];
          res.end(JSON.stringify(dados));return;
        }
        if (usaGroq) {
          const limite=Number(ambiente.GROQ_LIMITE_LOCAL_DIA||20);
          if(!Number.isInteger(limite)||limite<1||limite>100)falhar(503,'Limite local Groq inválido.');
          const inicio=new Date().setUTCHours(0,0,0,0);
          if(banco.prepare('SELECT count(*) n FROM groq_reservas WHERE instante>=?').get(inicio).n>=limite)falhar(429,'Limite diário local Groq atingido. Os registros continuam disponíveis.');
          banco.prepare('INSERT INTO groq_reservas VALUES (?,?,?)').run(chave+':'+criarToken().slice(0,8),Date.now(),groq.obterModelo());
        } else {
        const autorizacoes = {'2026-10-28-2-USD0.01':2,'2026-10-28-3-USD0.01':3,'2026-10-28-premium-5-USD0.025':8,'2026-10-28-premium-revalidacao-2-USD0.01':10};
        const limite = autorizacoes[ambiente.NUTRIFOTO_IA_AUTORIZADA];
        if (!limite) falhar(403, 'Premium local ativo. Novas chamadas de IA exigem autorização de orçamento; análises anteriores podem ser recuperadas sem cobrança.');
        if (banco.prepare('SELECT count(*) AS total FROM operacoes').get().total >= limite) falhar(429, 'As análises reais autorizadas foram utilizadas. Nova autorização é necessária. TACO e registros locais continuam disponíveis.');
        }
        if(repetirLimitada)banco.prepare("UPDATE operacoes SET estado='reservada' WHERE chave=?").run(chave);
        else banco.prepare("INSERT INTO operacoes VALUES (?,?,'reservada',NULL)").run(chave, hash);
        banco.exec('COMMIT');
      } catch (e) { try { banco.exec('ROLLBACK'); } catch {} throw e; }
      const executar = sugestao ? executarPremium : executarIA;
      const resultado = await executar(pedido, configuracao, async (url, opcoes, tempo) => {
        const corpo = JSON.parse(opcoes.body);
        if (pedido.tipo === 'foto') corpo.messages[1].content[1].image_url.detail = 'low';
        const textos = corpo.messages.map(m => typeof m.content === 'string' ? m.content : m.content.filter(c => c.type === 'text').map(c => c.text).join(' ')).join(' ');
        // Até 10.000 tokens de entrada e 3.500 de saída = US$0,0036; cinco novas tentativas cabem no teto autorizado de US$0,025.
        if (Buffer.byteLength(textos) > 5000 || corpo.model !== 'openai/gpt-4o-mini') falhar(400, 'Entrada excede o orçamento seguro da demonstração.');
        return (usaGroq?groq.transporte:transporte)(url, { ...opcoes, body: JSON.stringify(corpo) }, tempo);
      });
      resultado.uso={...resultado.uso,provedor,modelo:usaGroq?groq.obterModelo():'openai/gpt-4o-mini',...(usaGroq?{gratuidade:'confirmada_pelo_proprietario_no_painel'}:{})};
      const resposta = JSON.stringify(resultado);
      banco.prepare("UPDATE operacoes SET estado='concluida',resultado=? WHERE chave=?").run(resposta, chave);res.end(resposta);
    } catch (e) {
      if(usaGroq&&operacaoGroq&&e.status===429)banco.prepare("UPDATE operacoes SET estado='limitada' WHERE chave=? AND estado='reservada'").run(operacaoGroq);
      if(e.retryAfter)res.setHeader('Retry-After',String(e.retryAfter));
      res.statusCode = e.status || 500;res.end(JSON.stringify({ erro: e.status ? e.message : 'Falha no armazenamento local da demonstração. Nenhuma licença ou pagamento foi concedido.' }));
    }
  };
}
