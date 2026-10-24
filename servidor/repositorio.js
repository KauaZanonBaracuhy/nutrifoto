import { buscarJson, falhar } from './seguranca.js';
import { validarDadosIntegrais } from '../www/js/dadosValidacao.js';
import { validarAnalise, validarPerfil, validarPlano } from '../www/js/nutricao.js';

export function criarRepositorio(configuracao) {
  const { ambiente } = configuracao;
  async function chamarAutenticacao(caminho, metodo = 'GET', corpo, token, administrador = false) {
    const chave = administrador ? ambiente.SUPABASE_SERVICE_ROLE_KEY : ambiente.SUPABASE_ANON_KEY;
    return buscarJson(`${ambiente.SUPABASE_URL}/auth/v1/${caminho}`, {
      method: metodo,
      headers: { apikey: chave, Authorization: `Bearer ${token || chave}`, 'Content-Type': 'application/json' },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
  }
  async function executar(nome, parametros = {}) {
    const resposta = await buscarJson(`${ambiente.SUPABASE_URL}/rest/v1/rpc/${nome}`, {
      method: 'POST',
      headers: { apikey: ambiente.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ambiente.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parametros),
    }, 12000, ['nf_ler_dados', 'nf_gravar_dados'].includes(nome) ? 4_100_000 : 1_000_000);
    if (!resposta.ok) falhar(503, 'Persistência temporariamente indisponível.', 'BANCO_INDISPONIVEL');
    const resultado = resposta.dados;
    if (resultado?.erro) falhar(resultado.status || 400, resultado.erro, resultado.codigo);
    return resultado;
  }
  return { chamarAutenticacao, executar };
}

export function validarPacoteDados(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) falhar(400, 'Pacote de dados inválido.');
  const permitidas = new Set(['meals', 'weights', 'water', 'perfil', 'plano', 'metas', 'preferencias', 'tema', 'notificacoes', 'tutorial']);
  if (Object.keys(dados).some(chave => !permitidas.has(chave))) falhar(400, 'Campo de dados desconhecido.');
  for (const chave of ['meals', 'weights', 'water']) {
    if (dados[chave] !== undefined && (!Array.isArray(dados[chave]) || dados[chave].length > 10000)) falhar(400, 'Coleção inválida ou grande demais.');
  }
  if (Buffer.byteLength(JSON.stringify(dados), 'utf8') > 3_800_000) falhar(413, 'Metadados excedem 3,8 MB. Exporte os dados e contate o suporte antes de sincronizar.');
  if (dados.meals?.some(refeicao => !refeicao.dia)) falhar(400, 'Refeições precisam informar o dia local antes de sincronizar.');
  try {
    const validados=validarDadosIntegrais(dados);
    for(const refeicao of validados.meals)validarAnalise(refeicao);
    if(validados.perfil)validarPerfil(validados.perfil,{paraPlano:false});
    if(validados.plano)validarPlano(validados.plano);
    return validados;
  } catch (erro) { falhar(400, 'Há registros antigos ou inconsistentes que precisam de revisão antes de sincronizar. '+erro.message); }
}
