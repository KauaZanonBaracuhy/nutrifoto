import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { criarToken, falhar, resumir } from './seguranca.js';

const USUARIOS_FICTICIOS = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'ana@exemplo.test' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'bruno@exemplo.test' },
];

// Exclusivo para testes locais: não é um provedor de autenticação comercial.
export function criarSimulador(arquivo) {
  let fila = Promise.resolve();
  async function transacionar(operacao) {
    const proxima = fila.then(async () => {
      let estado;
      try { estado = JSON.parse(await readFile(arquivo, 'utf8')); }
      catch (erro) { if (erro.code !== 'ENOENT') throw erro; estado = { usuarios: USUARIOS_FICTICIOS, sessoes: {}, dados: {}, consumo: {}, operacoes: {}, limites: {}, assinaturas: {} }; }
      const resultado = await operacao(estado);
      await mkdir(dirname(arquivo), { recursive: true });
      await writeFile(`${arquivo}.tmp`, JSON.stringify(estado), { mode: 0o600 });
      await rename(`${arquivo}.tmp`, arquivo);
      return resultado;
    });
    fila = proxima.catch(() => {});
    return proxima;
  }
  async function chamarAutenticacao(caminho, metodo, corpo, token) {
    return transacionar(estado => {
      if (caminho === 'token?grant_type=password') {
        const usuario = estado.usuarios.find(item => item.email === corpo.email);
        if (!usuario || resumir(corpo.password || '') !== (estado.senhas?.[usuario.id] || resumir('Teste-local-2026!'))) return { ok: false, status: 400, dados: {} };
        const acesso = criarToken();
        estado.sessoes[resumir(acesso)] = { usuario, expira: Date.now() + 3600000 };
        return { ok: true, dados: { access_token: acesso, refresh_token: acesso, expires_in: 3600, user: usuario } };
      }
      if(caminho.startsWith('signup')){
        if(!/^[^@]+@[^@]+\.test$/.test(corpo.email||'')||estado.usuarios.some(usuario=>usuario.email===corpo.email))return {ok:false,status:400,dados:{}};
        const usuario={id:crypto.randomUUID(),email:corpo.email};estado.usuarios.push(usuario);estado.senhas||={};estado.senhas[usuario.id]=resumir(corpo.password);
        const acesso=criarToken();estado.sessoes[resumir(acesso)]={usuario,expira:Date.now()+3600000};
        return {ok:true,dados:{access_token:acesso,refresh_token:acesso,expires_in:3600,user:usuario}};
      }
      if(caminho.startsWith('recover')){
        const usuario=estado.usuarios.find(item=>item.email===corpo.email);
        if(usuario){const tokenRecuperacao=criarToken();estado.recuperacoes||={};estado.recuperacoes[tokenRecuperacao]={usuario:usuario.id,expira:Date.now()+600000};}
        return {ok:true,dados:{}};
      }
      if(caminho==='verify'){
        const recuperacao=estado.recuperacoes?.[corpo.token_hash];
        if(!recuperacao||recuperacao.expira<Date.now())return {ok:false,status:400,dados:{}};
        delete estado.recuperacoes[corpo.token_hash];const usuario=estado.usuarios.find(item=>item.id===recuperacao.usuario);
        const acesso=criarToken();estado.sessoes[resumir(acesso)]={usuario,expira:Date.now()+600000};
        return {ok:true,dados:{access_token:acesso,user:usuario}};
      }
      const sessao = estado.sessoes[resumir(token || '')];
      if (caminho === 'user' && metodo === 'GET') return { ok: Boolean(sessao && sessao.expira > Date.now()), dados: sessao?.usuario || {} };
      if(caminho==='user'&&metodo==='PUT'&&sessao){estado.senhas||={};estado.senhas[sessao.usuario.id]=resumir(corpo.password);return {ok:true,dados:sessao.usuario};}
      if (caminho.startsWith('logout')) { delete estado.sessoes[resumir(token || '')]; return { ok: true, dados: {} }; }
      if (caminho.startsWith('admin/users/') && metodo === 'DELETE') {
        const id = caminho.split('/').at(-1);
        estado.usuarios = estado.usuarios.filter(usuario => usuario.id !== id);
        Object.entries(estado.sessoes).forEach(([chave, valor]) => { if (valor.usuario.id === id) delete estado.sessoes[chave]; });
        delete estado.dados[id]; delete estado.consumo[id]; delete estado.assinaturas[id]; delete estado.imagens?.[id];
        Object.keys(estado.operacoes).forEach(chave => { if (chave.startsWith(id + ':')) delete estado.operacoes[chave]; });
        return { ok: true, dados: {} };
      }
      return { ok: false, status: 503, dados: {} };
    });
  }
  async function executar(nome, parametros) {
    return transacionar(estado => {
      const id = parametros.p_usuario;
      const chave = `${id}:${parametros.p_chave}`;
      if (nome.includes('imagem')) {
        estado.imagens ||= {};
        estado.imagens[id] ||= {};
        const imagens = estado.imagens[id];
        const identificador = parametros.p_imagem;
        if (nome === 'nf_reservar_imagem') {
          if (imagens[identificador]) return imagens[identificador];
          const total = Object.values(imagens).reduce((soma, imagem) => soma + imagem.tamanho, 0);
          if (total + parametros.p_tamanho > parametros.p_limite) falhar(429, 'Quota de armazenamento de imagens atingida.');
          imagens[identificador] = { tamanho: parametros.p_tamanho, pronta: false };
          return { pronta: false };
        }
        if (nome === 'nf_gravar_imagem_simulada') { imagens[identificador].dataUrl = parametros.p_data_url; return true; }
        if (nome === 'nf_finalizar_imagem') { imagens[identificador].pronta = true; return true; }
        if (nome === 'nf_ler_imagem') return imagens[identificador] || null;
      }
      if (nome === 'nf_sessao_ativa') return estado.usuarios.some(usuario => usuario.id === id) && (parametros.p_permitir_exclusao || !estado.exclusoes?.[id]);
      if (nome === 'nf_iniciar_exclusao') { estado.exclusoes ||= {}; estado.exclusoes[id] = true; return true; }
      if (nome === 'nf_limitar') {
        const janela = Math.floor(Date.now() / (parametros.p_janela * 1000));
        const indice = `${parametros.p_chave}:${janela}`;
        estado.limites[indice] = (estado.limites[indice] || 0) + 1;
        if (estado.limites[indice] > parametros.p_limite) falhar(429, 'Muitas tentativas. Aguarde e tente novamente.');
        return true;
      }
      if (nome === 'nf_ler_dados') return estado.dados[id] || { revisao: 0, dados: {} };
      if (nome === 'nf_gravar_dados') {
        const existente = estado.operacoes[chave];
        if (existente) { if (existente.hash !== parametros.p_hash) falhar(409, 'Chave reutilizada para outra operação.'); return existente.resultado; }
        const anterior = estado.dados[id] || { revisao: 0, dados: {} };
        if (anterior.revisao !== parametros.p_revisao) falhar(409, 'Dados alterados em outro dispositivo. Recarregue antes de salvar.', 'CONFLITO_REVISAO');
        const resultado = { revisao: anterior.revisao + 1, dados: parametros.p_dados };
        estado.dados[id] = resultado;
        estado.operacoes[chave] = { hash: parametros.p_hash, resultado };
        return resultado;
      }
      if (nome === 'nf_assinatura') return { plano: 'gratuito', status: 'simulado', consumo: estado.consumo[id] || 0, limite: parametros.p_limite_gratis, simulado: true };
      if (nome === 'nf_reservar_ia') {
        const existente = estado.operacoes[chave];
        if (existente) {
          if (existente.hash !== parametros.p_hash) falhar(409, 'Chave reutilizada para outra operação.');
          if (existente.resultado) return { repetido: true, resultado: existente.resultado };
          falhar(409, 'Operação já recebida. Aguarde ou use nova operação.');
        }
        if ((estado.consumo[id] || 0) >= parametros.p_limite_gratis) falhar(429, 'Quota de IA atingida.', 'QUOTA_EXCEDIDA');
        estado.consumo[id] = (estado.consumo[id] || 0) + 1;
        estado.operacoes[chave] = { hash: parametros.p_hash };
        return { repetido: false };
      }
      if (nome === 'nf_finalizar_ia') { estado.operacoes[chave].resultado = parametros.p_resultado; return true; }
      if (nome === 'nf_apagar_dados') { delete estado.dados[id]; return true; }
      falhar(503, 'Operação simulada não disponível.');
    });
  }
  return { chamarAutenticacao, executar };
}
