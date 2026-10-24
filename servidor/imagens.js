import { falhar, resumir, lerRespostaLimitada } from './seguranca.js';
import { validarPedidoIA } from './ia.js';
import { obterCapacidades } from './comercial.js';

export function validarIdentificadorImagem(id) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(id || '')) falhar(400, 'Identificador de imagem inválido.');
  return id;
}

export function lerImagem(pedido) {
  const partes = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(pedido.dataUrl || '');
  if (!partes) falhar(400, 'Imagem inválida.');
  validarPedidoIA({ tipo: 'foto', mediaType: partes[1], base64: partes[2] }, {});
  const bytes = Buffer.from(partes[2], 'base64');
  if (bytes.length > 1_000_000) falhar(413, 'Imagem excede 1 MB. Reduza a foto antes de sincronizar.');
  const extensao = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[partes[1]];
  return { id: `${resumir(bytes)}.${extensao}`, bytes, tipo: partes[1] };
}

async function chamarStorage(configuracao, usuario, id, metodo, bytes, tipo) {
  const ambiente = configuracao.ambiente;
  const caminho = `${usuario}/${validarIdentificadorImagem(id)}`;
  let resposta;
  try {
    resposta = await fetch(`${ambiente.SUPABASE_URL}/storage/v1/object/nutrifoto-imagens/${caminho}`, {
      method: metodo, signal: AbortSignal.timeout(15000),
      headers: { apikey: ambiente.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ambiente.SUPABASE_SERVICE_ROLE_KEY}`, ...(tipo ? { 'Content-Type': tipo, 'x-upsert': 'true' } : {}) },
      ...(bytes ? { body: bytes } : {}),
    });
    if (!resposta.ok) falhar(503, 'Armazenamento de imagens temporariamente indisponível.');
    if (metodo === 'GET') {
      const buffer = await lerRespostaLimitada(resposta, 1_000_000);
      const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[id.split('.').at(-1)];
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    return true;
  } catch (erro) { if (erro.status) throw erro; falhar(503, 'Armazenamento de imagens temporariamente indisponível.'); }
}

export async function gravarImagem(pedido, usuario, repositorio, configuracao) {
  const imagem = lerImagem(pedido);
  const capacidades = (await obterCapacidades(usuario, repositorio, configuracao)).capacidades;
  const limite = capacidades.armazenamentoBytes;
  if (!Number.isSafeInteger(limite) || limite < 0 || limite > 1_000_000_000) falhar(503, 'Quota de imagens não configurada.');
  const reserva = await repositorio.executar(configuracao.simulado ? 'nf_reservar_imagem' : 'nf_reservar_imagem_comercial', { p_usuario: usuario.id, p_imagem: imagem.id, p_tamanho: imagem.bytes.length, p_limite: limite, ...(configuracao.simulado ? {} : { p_quantidade: capacidades.fotos }) });
  if (!reserva.pronta) {
    if (configuracao.simulado) await repositorio.executar('nf_gravar_imagem_simulada', { p_usuario: usuario.id, p_imagem: imagem.id, p_data_url: pedido.dataUrl });
    else await chamarStorage(configuracao, usuario.id, imagem.id, 'POST', imagem.bytes, imagem.tipo);
    await repositorio.executar('nf_finalizar_imagem', { p_usuario: usuario.id, p_imagem: imagem.id });
  }
  return { id: imagem.id, simulado: configuracao.simulado };
}

export async function obterImagem(id, usuario, repositorio, configuracao) {
  validarIdentificadorImagem(id);
  const registro = await repositorio.executar('nf_ler_imagem', { p_usuario: usuario.id, p_imagem: id });
  if (!registro?.pronta) falhar(404, 'Imagem não encontrada nesta conta.');
  const dataUrl = configuracao.simulado ? registro.dataUrl : await chamarStorage(configuracao, usuario.id, id, 'GET');
  return { id, dataUrl };
}

export async function apagarImagensDaConta(usuario, repositorio, configuracao) {
  if (configuracao.simulado) return;
  // Paginação por lotes: nenhuma lista ilimitada de imagens é carregada em memória.
  for (let lote = 0; lote < 100; lote++) {
    const registros = await repositorio.executar('nf_listar_imagens', { p_usuario: usuario.id });
    if (!registros.length) return;
    const removidas = await fetch(`${configuracao.ambiente.SUPABASE_URL}/storage/v1/object/nutrifoto-imagens`, {
      method: 'DELETE', signal: AbortSignal.timeout(15000),
      headers: { apikey: configuracao.ambiente.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${configuracao.ambiente.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: registros.map(registro => `${usuario.id}/${validarIdentificadorImagem(registro.id)}`) }),
    }).catch(() => null);
    if (!removidas?.ok) falhar(503, 'Exclusão de imagens incompleta. Tente novamente antes de encerrar a conta.');
    await repositorio.executar('nf_remover_imagens', { p_usuario: usuario.id, p_imagens: registros.map(registro => registro.id) });
  }
  falhar(503, 'Exclusão de imagens requer mais uma tentativa.');
}
