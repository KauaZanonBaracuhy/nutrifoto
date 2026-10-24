import { buscarJson, falhar } from './seguranca.js';
const ORIGEM = 'https://api-sandbox.asaas.com/v3';
export function criarAsaas(ambiente, transporte = buscarJson) {
  if (ambiente.ASAAS_AMBIENTE !== 'sandbox' || !ambiente.ASAAS_API_KEY || ambiente.ASAAS_API_KEY.includes('$aact_prod_')) falhar(503, 'Asaas sandbox ainda não configurado.');
  async function chamar(caminho, method = 'GET', dados) {
    const resposta = await transporte(ORIGEM + caminho, { method, headers: { access_token: ambiente.ASAAS_API_KEY, 'User-Agent': 'NutriFoto/0.3.0', 'Content-Type': 'application/json' }, ...(dados ? { body: JSON.stringify(dados) } : {}) });
    if (!resposta.ok) falhar(502, 'Não foi possível consultar o Pix sandbox. Tente atualizar a situação.');
    return resposta.dados;
  }
  return {
    cliente: dados => chamar('/customers', 'POST', { name: dados.nome, cpfCnpj: dados.documento, notificationDisabled: true }),
    criar: dados => chamar('/payments', 'POST', dados),
    consultar: id => chamar('/payments/' + encodeURIComponent(id)),
    localizar: id => chamar('/payments?externalReference=' + encodeURIComponent(id) + '&limit=2'),
    qr: id => chamar('/payments/' + encodeURIComponent(id) + '/pixQrCode'),
  };
}
