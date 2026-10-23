import { falhar } from './seguranca.js';
export function politicaLicencas(ambiente = {}) {
  function franquia(nome, padrao, maximo) {
    const valor = Number(ambiente[nome] ?? padrao);
    if (!Number.isSafeInteger(valor) || valor < 0 || valor > maximo) falhar(503, 'Franquia textual inválida.');
    return valor;
  }
  const planos = [
    { id: 'ia', nome: 'NutriFoto IA', centavos: 2490, dias: 30, fotos: 50, textos: franquia('LICENCA_TEXTOS_IA_DIA', 20, 100), acompanhamento: false },
    { id: 'completo', nome: 'NutriFoto Completo', centavos: 3490, dias: 30, fotos: 100, textos: franquia('LICENCA_TEXTOS_COMPLETO_DIA', 50, 200), acompanhamento: true },
  ];
  if (planos[1].textos < planos[0].textos) falhar(503, 'A franquia textual Completo deve ser igual ou maior que a IA.');
  return planos;
}
export function planoLicenca(id, ambiente) {
  const plano = politicaLicencas(ambiente).find(item => item.id === id);
  if (!plano) falhar(400, 'Escolha um plano disponível.');
  return plano;
}
export function situacaoLicenca(registro, ambiente, agora = Date.now()) {
  const estado = registro.estado;
  const ativa = !estado.bloqueada && Date.parse(estado.validade) > agora;
  return { id: registro.id, ativa, plano: estado.plano || null, validade: estado.validade || null,
    diasRestantes: ativa ? Math.ceil((Date.parse(estado.validade) - agora) / 86400000) : 0,
    bloqueada: Boolean(estado.bloqueada), planos: politicaLicencas(ambiente), sandbox: true,
    acompanhamento: ativa && estado.plano === 'completo', fusoDiario: 'America/Sao_Paulo' };
}
