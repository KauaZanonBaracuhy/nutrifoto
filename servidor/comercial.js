import { falhar } from './seguranca.js';

function inteiro(ambiente, nome, padrao, maximo) {
  const valor = Number(ambiente[nome] ?? padrao);
  if (!Number.isSafeInteger(valor) || valor < 0 || valor > maximo) falhar(503, `Configuração comercial inválida: ${nome}.`);
  return valor;
}

export function obterPoliticaComercial(configuracao) {
  const ambiente = configuracao.ambiente;
  const plano = (sufixo, quota) => ({
    analises: quota,
    fotos: inteiro(ambiente, `FOTOS_LIMITE_${sufixo}`, configuracao.simulado ? 10000 : 0, 10000),
    armazenamentoBytes: inteiro(ambiente, `IMAGENS_LIMITE_${sufixo}_BYTES`, ambiente.IMAGENS_LIMITE_BYTES ?? (configuracao.simulado ? 50000000 : 0), 1000000000),
    analiseTexto: quota > 0,
    analiseFoto: quota > 0 && ambiente[`IA_FOTO_${sufixo}`] !== 'false',
    sincronizacao: ambiente[`SINCRONIZACAO_${sufixo}`] !== 'false',
    planos: ambiente.PLANOS_HOMOLOGADOS === 'true',
  });
  const precos = { mensal: ambiente.STRIPE_PRICE_MENSAL_ID || ambiente.STRIPE_PRICE_ID || '', anual: ambiente.STRIPE_PRICE_ANUAL_ID || '' };
  for (const preco of Object.values(precos)) if (preco && !/^price_[a-zA-Z0-9]+$/.test(preco)) falhar(503, 'Preço de assinatura inválido.');
  return { gratuito: plano('GRATIS', configuracao.limiteGratis), pago: plano('PAGO', configuracao.limitePago), precos };
}

export async function obterCapacidades(usuario, repositorio, configuracao) {
  const assinatura = await repositorio.executar('nf_assinatura', { p_usuario: usuario.id, p_limite_gratis: configuracao.limiteGratis, p_limite_pago: configuracao.limitePago });
  const politica = obterPoliticaComercial(configuracao);
  return { ...assinatura, capacidades: politica[assinatura.plano === 'pago' ? 'pago' : 'gratuito'], periodos: Object.entries(politica.precos).filter(([, preco]) => preco).map(([periodo]) => periodo), sandbox: true };
}
