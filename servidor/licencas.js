import { createPublicKey, verify, randomUUID } from 'node:crypto';
import { falhar, criarToken, resumir, compararSegredo, lerCorpo, obterConfiguracao } from './seguranca.js';
import { criarRepositorio } from './repositorio.js';
import { politicaLicencas, planoLicenca, situacaoLicenca } from './licenca-politica.js';
import { criarAsaas } from './asaas.js';
import { validarAtestadoAndroid } from './atestado-android.js';
import { validarPedidoIA, executarIA } from './ia.js';
import { obterOrcamentoIA } from './custos.js';

async function atualizarLicenca(repositorio, id, alterar) {
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const atual = await repositorio.executar('nf_licenca_ler_id', { p_id: id });
    if (!atual) falhar(403, 'Licença indisponível.');
    const alteracao = alterar(structuredClone(atual.estado), atual);
    const salvo = await repositorio.executar('nf_licenca_cas', { p_id: id, p_revisao: atual.revisao, p_estado: alteracao.estado, p_recuperacao: alteracao.recuperacao || null });
    if (salvo) return salvo;
  }
  falhar(409, 'Outra operação está em andamento. Atualize a situação.');
}
function conferirCobranca(cobranca, compra, referencia) {
  if (cobranca.externalReference !== referencia || cobranca.billingType !== 'PIX' || Math.round(Number(cobranca.value) * 100) !== compra.centavos || cobranca.customer !== compra.cliente || (compra.pagamento && compra.pagamento !== cobranca.id)) falhar(409, 'A cobrança não corresponde à compra registrada.');
}
async function conciliar(repositorio, asaas, registro, referencia) {
  const compra = registro.estado.compras[referencia];
  if (!compra) falhar(404, 'Compra não encontrada.');
  let cobranca;
  if (compra.pagamento) cobranca = await asaas.consultar(compra.pagamento);
  else { const lista = await asaas.localizar(referencia); if (lista.data?.length !== 1) return registro; cobranca = lista.data[0]; }
  conferirCobranca(cobranca, compra, referencia);
  return atualizarLicenca(repositorio, registro.id, estado => {
    const atual = estado.compras[referencia];
    atual.pagamento = cobranca.id; atual.status = cobranca.status;
    if (cobranca.status === 'RECEIVED' && !cobranca.deleted && !atual.creditada && !atual.revertida) {
      atual.creditada = true;
      estado.validade = new Date(Math.max(Date.now(), Date.parse(estado.validade) || 0) + 30 * 86400000).toISOString();
      // Renovar outro plano durante a vigência exige encerrar a oferta anterior, evitando perder benefícios.
      estado.plano = atual.plano;
    }
    if (cobranca.deleted || ['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(cobranca.status) || cobranca.refunds?.length) {
      atual.revertida = true;
      if (atual.creditada) estado.bloqueada = true;
    }
    return { estado };
  });
}
export function criarApiLicencas({ ambiente = process.env, repositorio: adaptador, asaas: asaasTeste, executarModelo = executarIA, verificarAtestado = validarAtestadoAndroid } = {}) {
  return async (requisicao, resposta) => {
    resposta.setHeader('Content-Type', 'application/json; charset=utf-8');resposta.setHeader('Cache-Control', 'no-store');resposta.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (requisicao.method === 'GET') { resposta.end(JSON.stringify({ planos: politicaLicencas(ambiente), sandbox: true })); return; }
      if (requisicao.method !== 'POST') falhar(405, 'Método não permitido.');
      const configuracao = obterConfiguracao(ambiente), repositorio = adaptador || criarRepositorio(configuracao);
      if (ambiente.LICENCAS_ANDROID !== 'true') falhar(503, 'Ativação Android ainda não configurada no servidor.');
      const caminho = new URL(requisicao.url, configuracao.origem).pathname;
      const pedido = await lerCorpo(requisicao);
      if (caminho === '/api/asaas-webhook') {
        if (!ambiente.ASAAS_WEBHOOK_TOKEN || ambiente.ASAAS_WEBHOOK_TOKEN.length < 32 || !compararSegredo(ambiente.ASAAS_WEBHOOK_TOKEN, requisicao.headers['asaas-access-token'])) falhar(403, 'Webhook inválido.');
        if (ambiente.ASAAS_AMBIENTE !== 'sandbox' || !/^evt_[\w-]{1,100}$/.test(pedido.id || '') || !/^pay_[\w-]{1,100}$/.test(pedido.payment?.id || '')) falhar(400, 'Evento inválido.');
        const asaas = asaasTeste || criarAsaas(ambiente);
        // Nunca confiar no status, valor ou referência recebidos pelo webhook.
        const prova = await asaas.consultar(pedido.payment.id);
        const registro = await repositorio.executar('nf_licenca_cobranca', { p_referencia: prova.externalReference || '' });
        if (registro) await conciliar(repositorio, asaas, registro, prova.externalReference);
        resposta.end(JSON.stringify({ recebido: true }));return;
      }
      const endereco = ambiente.VERCEL ? String(requisicao.headers['x-vercel-forwarded-for'] || '').split(',')[0] : requisicao.socket?.remoteAddress || 'local';
      await repositorio.executar('nf_limitar', { p_chave: 'licenca:' + resumir((ambiente.RATE_LIMIT_SALT || '') + endereco), p_limite: 180, p_janela: 60 });
      if (pedido.acao === 'desafio') {
        const nonce = criarToken(); await repositorio.executar('nf_licenca_desafio', { p_nonce: nonce });
        resposta.end(JSON.stringify({ nonce }));return;
      }
      const { publica, chave, nonce, assinatura } = pedido;
      if (!/^[a-f0-9]{64}$/.test(chave || '') || !/^[\w-]{43}$/.test(nonce || '') || typeof publica !== 'string' || publica.length > 400 || typeof assinatura !== 'string' || assinatura.length > 200) falhar(400, 'Identidade inválida.');
      const bytes = Buffer.from(publica, 'base64');
      if (resumir(bytes) !== chave) falhar(403, 'Chave não corresponde à instalação.');
      const publicaValidada = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
      if (publicaValidada.asymmetricKeyType !== 'ec' || publicaValidada.asymmetricKeyDetails?.namedCurve !== 'prime256v1') falhar(403, 'Chave Android inválida.');
      const conteudo = JSON.stringify(pedido.pedido);
      if (!verify('sha256', Buffer.from('NF1\n' + nonce + '\n' + resumir(conteudo)), publicaValidada, Buffer.from(assinatura, 'base64'))) falhar(403, 'Assinatura da instalação inválida.');
      if (!await repositorio.executar('nf_licenca_desafio', { p_nonce: nonce, p_consumir: true })) falhar(403, 'Desafio expirado ou já utilizado.');
      let registro = await repositorio.executar('nf_licenca_ler', { p_chave: chave });
      if (!registro) {
        // A injeção de atestado fictício só existe no harness; não é selecionável pelo cliente.
        await verificarAtestado(pedido, ambiente);
        registro = await repositorio.executar('nf_licenca_inscrever', { p_chave: chave, p_publica: publica });
      }
      const operacao = pedido.pedido;
      let resultado;
      if (operacao.acao === 'situacao') {
        const pendente = operacao.compra || Object.keys(registro.estado.compras).find(id => { const compra = registro.estado.compras[id]; return !compra.creditada && !compra.revertida && !['CANCELLED','DELETED','OVERDUE'].includes(compra.status); });
        let qr = null;
        if (pendente) {
          const asaas = asaasTeste || criarAsaas(ambiente);
          registro = await conciliar(repositorio, asaas, registro, pendente);
          const compra = registro.estado.compras[pendente];
          if (compra.pagamento && !compra.creditada && !compra.revertida && !['CANCELLED','DELETED','OVERDUE'].includes(compra.status)) qr = await asaas.qr(compra.pagamento);
        }
        const uso = await repositorio.executar('nf_licenca_uso', { p_id: registro.id });
        resultado = { ...situacaoLicenca(registro, ambiente), uso, qr, compraPendente: pendente || null, compraStatus: pendente ? registro.estado.compras[pendente]?.revertida ? 'REVERTIDA' : registro.estado.compras[pendente]?.status : null };
      } else if (operacao.acao === 'recuperacao') {
        const codigo = criarToken();
        await atualizarLicenca(repositorio, registro.id, (estado, atual) => { if (atual.chave !== chave) falhar(403, 'Licença transferida.'); return { estado, recuperacao: resumir(codigo) }; });
        resultado = { codigo };
      } else if (operacao.acao === 'transferir') {
        if (!/^[\w-]{43}$/.test(operacao.codigo || '')) falhar(400, 'Informe o código de recuperação completo.');
        const transferida = await repositorio.executar('nf_licenca_transferir', { p_atual: registro.id, p_codigo: resumir(operacao.codigo), p_chave: chave, p_publica: publica });
        resultado = situacaoLicenca(transferida, ambiente);
      } else if (operacao.acao === 'pix') {
        const plano = planoLicenca(operacao.plano, ambiente), referencia = operacao.intencao;
        const dados = operacao.pagador || {};
        if (typeof dados.nome !== 'string' || dados.nome.trim().length < 3 || dados.nome.length > 100 || !/^\d{11}$|^\d{14}$/.test(dados.documento || '')) falhar(400, 'Informe nome e CPF/CNPJ válidos para o pagamento.');
        if (!/^[a-f0-9-]{36}$/.test(referencia || '')) falhar(400, 'Intenção de compra inválida.');
        if (registro.estado.bloqueada) falhar(403, 'Uma reversão exige revisão do suporte antes de renovar.');
        if (!configuracao.simulado && !ambiente.OPENROUTER_API_KEY) falhar(503, 'IA ainda não configurada. Nenhuma cobrança foi criada.');
        if (obterOrcamentoIA(configuracao).p_reserva > 0.05) falhar(503, 'Orçamento de IA não aprovado. Nenhuma cobrança foi criada.');
        if (situacaoLicenca(registro, ambiente).ativa && registro.estado.plano !== plano.id) falhar(409, 'Durante a vigência, renove o mesmo plano. A troca fica disponível após o vencimento.');
        const asaas = asaasTeste || criarAsaas(ambiente);
        // A intenção é persistida ANTES de qualquer criação remota. Timeout nunca repete o POST financeiro.
        let criar = false;
        registro = await atualizarLicenca(repositorio, registro.id, (estado, atual) => {
          criar = false;if (atual.chave !== chave) falhar(403, 'Licença transferida.');
          if (estado.bloqueada) falhar(403, 'Pagamento em revisão. Procure o suporte.');
          if (!estado.compras[referencia]) {
            if (Object.values(estado.compras).some(compra => !compra.creditada && !compra.revertida && !['CANCELLED', 'DELETED', 'OVERDUE'].includes(compra.status))) falhar(409, 'Atualize a compra pendente antes de criar outra.');
            estado.compras[referencia] = { plano: plano.id, centavos: plano.centavos, status: 'PREPARANDO' };
          } else if (estado.compras[referencia].plano !== plano.id) falhar(409, 'Esta intenção pertence a outro plano.');
          criar = estado.compras[referencia].status === 'PREPARANDO';
          return { estado };
        });
        if (criar) {
          const cliente = await asaas.cliente(dados);
          registro = await atualizarLicenca(repositorio, registro.id, (estado, atual) => {
            if (estado.bloqueada || atual.chave !== chave) falhar(403, 'Ativação alterada durante a compra. Atualize a situação.');
            criar = estado.compras[referencia].status === 'PREPARANDO';
            if (criar) { estado.compras[referencia].cliente = cliente.id;estado.compras[referencia].status = 'CRIANDO_COBRANCA'; }
            return { estado };
          });
          if (criar) {
            const cobranca = await asaas.criar({ customer: cliente.id, billingType: 'PIX', value: plano.centavos / 100, dueDate: new Date().toISOString().slice(0, 10), externalReference: referencia, description: plano.nome + ' — 30 dias, sem renovação automática', interest: { value: 0 }, fine: { value: 0 } });
            conferirCobranca(cobranca, registro.estado.compras[referencia], referencia);
            registro = await atualizarLicenca(repositorio, registro.id, estado => { estado.compras[referencia].pagamento = cobranca.id; return { estado }; });
          }
        }
        registro = await conciliar(repositorio, asaas, registro, referencia);
        const compra = registro.estado.compras[referencia];
        if (!compra.pagamento) falhar(409, 'Criação em confirmação. Atualize esta mesma compra; não gere outra cobrança.');
        const qr = compra.creditada || compra.revertida ? null : await asaas.qr(compra.pagamento);
        resultado = { compra: referencia, status: compra.status, qr, ...situacaoLicenca(registro, ambiente) };
      } else if (operacao.acao === 'autorizar') {
        const situacao = situacaoLicenca(registro, ambiente);
        if (!situacao.ativa || operacao.recurso !== 'acompanhamento' || !situacao.acompanhamento) falhar(403, 'Este recurso exige uma licença NutriFoto Completo vigente. Seus dados anteriores continuam preservados.');
        resultado = { autorizado: true };
      } else if (operacao.acao === 'analise') {
        if (operacao.ciencia !== true) falhar(403, 'Confirme o envio da imagem ou texto à IA.');
        if (operacao.dados?.tipo === 'plano') falhar(403, 'Planos clínicos e metas automáticas continuam bloqueados.');
        if (!situacaoLicenca(registro, ambiente).ativa) falhar(403, 'Ative ou renove sua licença para usar a IA.');
        if (!configuracao.simulado && !ambiente.OPENROUTER_API_KEY) falhar(503, 'IA ainda não configurada no servidor.');
        const dados = validarPedidoIA(operacao.dados, configuracao), plano = planoLicenca(registro.estado.plano, ambiente);
        if (!/^[a-f0-9-]{36}$/.test(operacao.intencao || '')) falhar(400, 'Intenção de análise inválida.');
        const orcamento = obterOrcamentoIA(configuracao);
        if (orcamento.p_reserva > 0.05) falhar(503, 'Reserva superior ao teto seguro por análise.');
        const reserva = await repositorio.executar('nf_licenca_reservar', { p_id: registro.id, p_dispositivo: chave, p_chave: operacao.intencao, p_hash: resumir(JSON.stringify(dados)), p_tipo: dados.tipo, p_limite: dados.tipo === 'foto' ? plano.fotos : plano.textos, p_global: orcamento.p_limite_global, p_individual: orcamento.p_limite_usuario, p_reserva: orcamento.p_reserva });
        if (reserva.repetido) resultado = reserva.resultado;
        else {
          resultado = await executarModelo(dados, configuracao);
          await repositorio.executar('nf_licenca_finalizar', { p_id: registro.id, p_chave: operacao.intencao, p_resultado: resultado, p_custo: Number.isFinite(resultado.uso?.custoUsd) ? resultado.uso.custoUsd : null });
        }
      } else falhar(400, 'Operação desconhecida.');
      resposta.end(JSON.stringify(resultado));
    } catch (erro) { resposta.statusCode = erro.status || 500; resposta.end(JSON.stringify({ erro: erro.status ? erro.message : 'Não foi possível concluir a ativação. Tente atualizar a situação.', codigo: erro.codigo || 'FALHA_LICENCA' })); }
  };
}
