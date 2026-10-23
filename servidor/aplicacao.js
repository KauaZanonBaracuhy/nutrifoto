import { criarToken, resumir, falhar, obterConfiguracao, lerCookies, definirCookie, validarOrigem, lerCorpo, obterIdempotencia } from './seguranca.js';
import { criarRepositorio, validarPacoteDados } from './repositorio.js';
import { validarPedidoIA, executarIA } from './ia.js';
import { abrirPagamento, receberWebhook, chamarStripe } from './assinatura.js';
import { gravarImagem, obterImagem, apagarImagensDaConta } from './imagens.js';
import { obterCapacidades } from './comercial.js';
import { reservarAnalise, finalizarAnalise } from './custos.js';
import { registrarMetrica } from './operacao.js';
import { criarApiLicencas } from './licencas.js';

function informarUsuario(usuario) { return { id: usuario.id, email: usuario.email }; }

export function criarAplicacao({ ambiente = process.env, repositorio: adaptador, registrar = console.info, executarModelo = executarIA } = {}) {
  const atenderLicencas = criarApiLicencas({ ambiente, repositorio: adaptador, executarModelo });
  return async function atenderRequisicao(requisicao, resposta) {
    if (['/api/licenca', '/api/asaas-webhook'].includes(requisicao.url.split('?')[0])) return atenderLicencas(requisicao, resposta);
    const inicio = Date.now();
    const identificador = criarToken().slice(0, 16);
    let status = 200;
    let cienciaIa = false;
    let repositorio; let caminho;
    resposta.setHeader('Content-Type', 'application/json; charset=utf-8');
    resposta.setHeader('Cache-Control', 'no-store');
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader('X-Request-Id', identificador);
    try {
      const configuracao = obterConfiguracao(ambiente);
      repositorio = adaptador || criarRepositorio(configuracao);
      caminho = new URL(requisicao.url, configuracao.origem).pathname;
      if (caminho === '/api/ia' && ambiente.LICENCAS_ANDROID === 'true') falhar(403, 'Utilize a instalação Android ativada para acessar a IA.');
      const metodo = requisicao.method;
      const cookies = lerCookies(requisicao);
      if (caminho === '/api/webhook') {
        if (metodo !== 'POST') falhar(405, 'Método não permitido.');
        const resultado = await receberWebhook(await lerCorpo(requisicao, 200000, true), requisicao.headers['stripe-signature'], repositorio, configuracao);
        resposta.end(JSON.stringify(resultado)); return;
      }
      if (!['/api/conta', '/api/dados', '/api/ia', '/api/assinatura', '/api/imagens'].includes(caminho)) falhar(404, 'Endpoint não encontrado.');
      if (metodo !== 'GET') validarOrigem(requisicao, configuracao);
      // Endereço vindo do proxy somente no ambiente Vercel; não confiar no cabeçalho em execução local.
      const endereco = ambiente.VERCEL ? String(requisicao.headers['x-vercel-forwarded-for'] || '').split(',')[0] : requisicao.socket?.remoteAddress || 'local';
      const indiceLimite = resumir(`${ambiente.RATE_LIMIT_SALT || 'simulacao-local'}:${endereco}`);
      await repositorio.executar('nf_limitar', { p_chave: `rede:${indiceLimite}`, p_limite: 120, p_janela: 60 });
      async function autenticar(obrigatorio = true) {
        let token = cookies.nf_acesso;
        let resultado = token ? await repositorio.chamarAutenticacao('user', 'GET', undefined, token) : { ok: false };
        if (!resultado.ok && cookies.nf_renovacao && !configuracao.simulado) {
          const renovada = await repositorio.chamarAutenticacao('token?grant_type=refresh_token', 'POST', { refresh_token: cookies.nf_renovacao });
          if (renovada.ok && renovada.dados.access_token) {
            token = renovada.dados.access_token;
            gravarSessao(renovada.dados);
            resultado = await repositorio.chamarAutenticacao('user', 'GET', undefined, token);
          }
        }
        if (!resultado.ok || !resultado.dados.id) {
          if (obrigatorio) falhar(401, 'Entre na sua conta para continuar.', 'SESSAO_NECESSARIA');
          return null;
        }
        let sessao = null;
        if (!configuracao.simulado) {
          try { sessao = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).session_id; } catch { falhar(401, 'Sessão inválida.'); }
          if (!sessao) falhar(401, 'Sessão inválida.');
        }
        const ativa = await repositorio.executar('nf_sessao_ativa', { p_usuario: resultado.dados.id, p_sessao: sessao, p_permitir_exclusao: caminho === '/api/conta' });
        if (!ativa) { if (obrigatorio) falhar(401, 'Sessão encerrada. Entre novamente.'); return null; }
        // Precondição da aba: nunca concede acesso; evita aplicar dados de outra conta
        // quando um login em outra aba substituiu os cookies compartilhados.
        const contaEsperada = requisicao.headers['x-conta-esperada'];
        if (contaEsperada !== undefined && (typeof contaEsperada !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(contaEsperada) || contaEsperada.toLowerCase() !== resultado.dados.id.toLowerCase())) falhar(409, 'A conta mudou em outra aba. Entre novamente antes de continuar.', 'CONTA_ALTERADA');
        return { ...resultado.dados, token };
      }
      function gravarSessao(sessao) {
        definirCookie(resposta, 'nf_acesso', sessao.access_token, configuracao, Math.max(1, Number(sessao.expires_in) || 3600));
        definirCookie(resposta, 'nf_renovacao', sessao.refresh_token, configuracao);
      }
      function limparSessao() {
        for (const nome of ['nf_acesso', 'nf_renovacao', 'nf_csrf']) definirCookie(resposta, nome, '', configuracao, 0);
      }
      async function atenderConta() {
        if (metodo === 'GET') {
          const csrf = cookies.nf_csrf && /^[a-zA-Z0-9_-]{43}$/.test(cookies.nf_csrf) ? cookies.nf_csrf : criarToken();
          definirCookie(resposta, 'nf_csrf', csrf, configuracao);
          const usuario = await autenticar(false);
          return { usuario: usuario ? informarUsuario(usuario) : null, csrf, simulado: configuracao.simulado, planosDisponiveis: configuracao.simulado || configuracao.ambiente.PLANOS_HOMOLOGADOS === 'true' };
        }
        if (metodo !== 'POST') falhar(405, 'Método não permitido.');
        const pedido = await lerCorpo(requisicao, 12000);
        await repositorio.executar('nf_limitar', { p_chave: `conta:${indiceLimite}`, p_limite: 15, p_janela: 900 });
        if (['entrar', 'cadastrar', 'recuperar'].includes(pedido.acao)) {
          const email = String(pedido.email || '').trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) falhar(400, 'Informe um e-mail válido.');
          if (pedido.acao !== 'recuperar' && (typeof pedido.senha !== 'string' || pedido.senha.length < 12 || pedido.senha.length > 128)) falhar(400, 'Use uma senha entre 12 e 128 caracteres.');
          if (pedido.acao === 'recuperar') {
            await repositorio.chamarAutenticacao(`recover?redirect_to=${encodeURIComponent(`${configuracao.origem}/?tela=conta`)}`, 'POST', { email });
            return { mensagem: 'Se existir uma conta, você receberá as instruções de recuperação.', simulado: configuracao.simulado };
          }
          const caminhoAuth = pedido.acao === 'entrar' ? 'token?grant_type=password' : `signup?redirect_to=${encodeURIComponent(`${configuracao.origem}/?tela=conta`)}`;
          const resultado = await repositorio.chamarAutenticacao(caminhoAuth, 'POST', { email, password: pedido.senha });
          if (!resultado.ok) falhar(400, configuracao.simulado && pedido.acao === 'cadastrar' ? 'Simulação usa somente as duas contas fictícias documentadas.' : 'Não foi possível autenticar. Verifique os dados ou confirme seu e-mail.', 'AUTENTICACAO_FALHOU');
          if (resultado.dados.access_token) gravarSessao(resultado.dados);
          return { usuario: resultado.dados.access_token ? informarUsuario(resultado.dados.user) : null, mensagem: resultado.dados.access_token ? 'Sessão iniciada.' : 'Confira seu e-mail para confirmar o cadastro.', simulado: configuracao.simulado };
        }
        if (pedido.acao === 'confirmar') {
          if (!/^[a-zA-Z0-9_-]{20,300}$/.test(pedido.token_hash || '')) falhar(400, 'Link de confirmação inválido.');
          const verificada = await repositorio.chamarAutenticacao('verify', 'POST', { token_hash: pedido.token_hash, type: 'signup' });
          if (!verificada.ok || !verificada.dados.access_token) falhar(400, 'Link de confirmação expirado ou inválido.');
          gravarSessao(verificada.dados);
          return { usuario: informarUsuario(verificada.dados.user), mensagem: 'E-mail confirmado. Sessão iniciada.' };
        }
        if (pedido.acao === 'redefinir') {
          if (!/^[a-zA-Z0-9_-]{20,300}$/.test(pedido.token_hash || '') || typeof pedido.senha !== 'string' || pedido.senha.length < 12 || pedido.senha.length > 128) falhar(400, 'Token ou senha inválidos.');
          const verificada = await repositorio.chamarAutenticacao('verify', 'POST', { token_hash: pedido.token_hash, type: 'recovery' });
          if (!verificada.ok || !verificada.dados.access_token) falhar(400, 'Link de recuperação expirado ou inválido.');
          const alterada = await repositorio.chamarAutenticacao('user', 'PUT', { password: pedido.senha }, verificada.dados.access_token);
          if (!alterada.ok) falhar(400, 'Não foi possível redefinir a senha.');
          await repositorio.chamarAutenticacao('logout?scope=global', 'POST', {}, verificada.dados.access_token);
          limparSessao();
          return { mensagem: 'Senha alterada. Entre novamente.' };
        }
        const usuario = await autenticar();
        if (pedido.acao === 'sair') {
          const encerrada = await repositorio.chamarAutenticacao('logout?scope=local', 'POST', {}, usuario.token);
          if (!encerrada.ok) falhar(503, 'Não foi possível encerrar a sessão no servidor. Tente novamente.');
          limparSessao(); return { mensagem: 'Sessão encerrada.' };
        }
        if (pedido.acao === 'excluir') {
          if (pedido.confirmacao !== 'EXCLUIR') falhar(400, 'Confirme a exclusão digitando EXCLUIR.');
          const cliente = configuracao.simulado ? null : await repositorio.executar('nf_cliente', { p_usuario: usuario.id, p_cliente: null });
          if (cliente) {
            const lista = await chamarStripe(configuracao, `subscriptions?customer=${encodeURIComponent(cliente)}&status=all&limit=100`);
            if (lista.has_more || lista.data?.some(item => !['canceled', 'incomplete_expired'].includes(item.status))) falhar(409, 'Cancele a assinatura no portal e aguarde seu encerramento antes de excluir a conta.', 'ASSINATURA_PENDENTE');
          }
          await repositorio.executar('nf_iniciar_exclusao', { p_usuario: usuario.id });
          await apagarImagensDaConta(usuario, repositorio, configuracao);
          const removida = await repositorio.chamarAutenticacao(`admin/users/${usuario.id}`, 'DELETE', undefined, undefined, true);
          if (!removida.ok) falhar(503, 'Exclusão da conta incompleta. Tente novamente; imagens já removidas não são recuperáveis.');
          limparSessao(); return { mensagem: 'Conta e dados sob controle do aplicativo excluídos. Registros legais dos provedores seguem suas políticas.' };
        }
        falhar(400, 'Ação de conta desconhecida.');
      }
      let resultado;
      if (caminho === '/api/conta') resultado = await atenderConta();
      else {
        const usuario = await autenticar();
        await repositorio.executar('nf_limitar', { p_chave: `usuario:${usuario.id}`, p_limite: 90, p_janela: 60 });
        if (caminho === '/api/imagens') {
          if (metodo === 'GET') resultado = await obterImagem(new URL(requisicao.url, configuracao.origem).searchParams.get('id'), usuario, repositorio, configuracao);
          else if (metodo === 'POST' || metodo === 'PUT') {
            obterIdempotencia(requisicao);
            resultado = await gravarImagem(await lerCorpo(requisicao, 1_400_000), usuario, repositorio, configuracao);
          } else falhar(405, 'Método não permitido.');
        } else if (caminho === '/api/dados') {
          if (!(await obterCapacidades(usuario, repositorio, configuracao)).capacidades.sincronizacao) falhar(403, 'Sincronização indisponível neste plano.');
          if (metodo === 'GET') resultado = await repositorio.executar('nf_ler_dados', { p_usuario: usuario.id });
          else if (metodo === 'PUT') {
            const pedido = await lerCorpo(requisicao);
            if (!Number.isSafeInteger(pedido.revisao) || pedido.revisao < 0) falhar(400, 'Revisão inválida.');
            const dados = validarPacoteDados(pedido.dados);
            resultado = await repositorio.executar('nf_gravar_dados', { p_usuario: usuario.id, p_dados: dados, p_revisao: pedido.revisao, p_chave: obterIdempotencia(requisicao), p_hash: resumir(JSON.stringify(pedido)) });
          } else falhar(405, 'Método não permitido.');
        } else if (caminho === '/api/assinatura') {
          if (metodo === 'GET') resultado = await obterCapacidades(usuario, repositorio, configuracao);
          else if (metodo === 'POST') resultado = await abrirPagamento(await lerCorpo(requisicao, 5000), usuario, repositorio, configuracao, obterIdempotencia(requisicao));
          else falhar(405, 'Método não permitido.');
        } else {
          if (metodo !== 'POST') falhar(405, 'Método não permitido.');
          if (requisicao.headers['x-ciencia-ia'] !== '1') falhar(403, 'Leia as informações de IA na área de privacidade antes de continuar.', 'CIENCIA_IA_NECESSARIA');
          cienciaIa = true;
          const pedido = validarPedidoIA(await lerCorpo(requisicao), configuracao);
          const capacidades = (await obterCapacidades(usuario, repositorio, configuracao)).capacidades;
          if ((pedido.tipo === 'foto' && !capacidades.analiseFoto) || (pedido.tipo === 'texto' && !capacidades.analiseTexto)) falhar(403, 'Esta análise não está disponível no seu plano.');
          if (!configuracao.simulado && !ambiente.OPENROUTER_API_KEY) falhar(503, 'IA ainda não configurada.');
          const chave = obterIdempotencia(requisicao);
          const reserva = await reservarAnalise(pedido, usuario, chave, repositorio, configuracao);
          if (reserva.repetido) resultado = reserva.resultado;
          else {
            resultado = await executarModelo(pedido, configuracao);
            await finalizarAnalise(resultado, usuario, chave, repositorio, configuracao);
          }
        }
      }
      resposta.end(JSON.stringify(resultado));
    } catch (erro) {
      status = erro.status || 500;
      resposta.statusCode = status;
      if (status === 429) resposta.setHeader('Retry-After', '60');
      resposta.end(JSON.stringify({ erro: erro.status ? erro.message : 'Falha interna. Tente novamente.', codigo: erro.codigo || 'FALHA_INTERNA', requisicao: identificador }));
    } finally {
      await registrarMetrica({ repositorio, caminho, status, duracaoMs: Date.now() - inicio, ambiente, registrar });
      registrar(JSON.stringify({ evento: 'http', requisicao: identificador, status, duracaoMs: Date.now() - inicio, ...(cienciaIa ? { cienciaIa: true } : {}) }));
    }
  };
}
