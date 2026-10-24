import { X509Certificate } from 'node:crypto';
import { buscarJson, falhar } from './seguranca.js';

// Leitura DER limitada à extensão Android assinada; nenhum identificador do aparelho é solicitado.
function lerDer(buffer, inicio = 0) {
  let cursor = inicio, identificador = buffer[cursor++], tag = identificador & 31;
  if (tag === 31) { tag = 0; let octetos = 0; do { if (++octetos > 4) throw new Error('Tag inválida'); const parte = buffer[cursor++]; tag = tag * 128 + (parte & 127); if (!(parte & 128)) break; } while (cursor < buffer.length); }
  let tamanho = buffer[cursor++];
  if (tamanho & 128) { const quantidade = tamanho & 127; if (!quantidade || quantidade > 4) throw new Error('Tamanho inválido'); tamanho = 0; for (let i = 0; i < quantidade; i++) tamanho = tamanho * 256 + buffer[cursor++]; }
  if (!Number.isSafeInteger(tamanho) || cursor + tamanho > buffer.length) throw new Error('DER incompleto');
  return { classe: identificador >> 6, tag, valor: buffer.subarray(cursor, cursor + tamanho), fim: cursor + tamanho };
}
function filhos(no) { const lista = []; for (let i = 0; i < no.valor.length;) { const item = lerDer(no.valor, i); lista.push(item); i = item.fim; } return lista; }
function numero(no) { return no?.valor.length === 1 ? no.valor[0] : -1; }
let revogacoes;
export async function validarAtestadoAndroid({ certificados, publica }, ambiente) {
  if (!ambiente.ANDROID_ATTESTATION_ROOTS_PEM) falhar(503, 'Validação do Android Keystore ainda não configurada.');
  try {
    if (!Array.isArray(certificados) || certificados.length < 2 || certificados.length > 6) throw new Error('Cadeia inválida');
    const cadeia = certificados.map(certificado => new X509Certificate(Buffer.from(certificado, 'base64')));
    const raizes = ambiente.ANDROID_ATTESTATION_ROOTS_PEM.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)?.map(pem => new X509Certificate(pem)) || [];
    const raiz = cadeia.at(-1);
    if (!raizes.some(item => item.fingerprint256 === raiz.fingerprint256) || !raiz.verify(raiz.publicKey)) throw new Error('Raiz não confiável');
    for (let i = 0; i < cadeia.length - 1; i++) {
      if (!cadeia[i].checkIssued(cadeia[i + 1]) || !cadeia[i].verify(cadeia[i + 1].publicKey) || !cadeia[i + 1].ca || Date.parse(cadeia[i].validFrom) > Date.now() || Date.parse(cadeia[i].validTo) < Date.now()) throw new Error('Certificado inválido');
    }
    if (cadeia[0].publicKey.export({ type: 'spki', format: 'der' }).toString('base64') !== publica) throw new Error('Chave diferente');
    const extensoes = filhos(filhos(lerDer(cadeia[0].raw))[0]).find(item => item.classe === 2 && item.tag === 3);
    const extensao = filhos(filhos(extensoes)[0]).find(item => filhos(item)[0].valor.equals(Buffer.from('2b06010401d679020111', 'hex')));
    const descricao = filhos(lerDer(filhos(extensao).at(-1).valor));
    if (![1, 2].includes(numero(descricao[1])) || ![1, 2].includes(numero(descricao[3])) || descricao[4].valor.length < 16) throw new Error('Sem proteção de hardware');
    const software = filhos(descricao[6]), hardware = filhos(descricao[7]);
    if ([...software, ...hardware].some(item => item.tag === 600)) throw new Error('Chave sem vínculo ao aplicativo');
    const origem = hardware.find(item => item.tag === 702), boot = hardware.find(item => item.tag === 704);
    if (!origem || numero(filhos(origem)[0]) !== 0 || !boot) throw new Error('Origem inválida');
    const confianca = filhos(filhos(boot)[0]);
    if (numero(confianca[1]) !== 255 || numero(confianca[2]) !== 0) throw new Error('Boot não verificado');
    const aplicativo = software.find(item => item.tag === 709);
    const identidade = filhos(lerDer(filhos(aplicativo)[0].valor));
    const pacotes = filhos(identidade[0]);
    const assinatura = (ambiente.ANDROID_APP_CERT_SHA256 || '').toLowerCase();
    if (pacotes.length !== 1 || filhos(pacotes[0])[0].valor.toString() !== 'com.nutrifoto.app' || !/^[a-f0-9]{64}$/.test(assinatura) || !filhos(identidade[1]).some(item => item.valor.toString('hex') === assinatura)) throw new Error('Aplicativo não autorizado');
    if (!revogacoes || revogacoes.vence < Date.now()) {
      const resposta = await buscarJson('https://android.googleapis.com/attestation/status', {}, 8000, 1000000);
      if (!resposta.ok || !resposta.dados.entries) throw new Error('Revogações indisponíveis');
      revogacoes = { entries: Object.fromEntries(Object.entries(resposta.dados.entries).map(([serial, estado]) => [serial.toLowerCase().replace(/^0+/, ''), estado])), vence: Date.now() + 300000 };
    }
    if (cadeia.some(item => revogacoes.entries[item.serialNumber.toLowerCase().replace(/^0+/, '')])) throw new Error('Atestado revogado');
  } catch { falhar(403, 'Não foi possível validar a proteção desta instalação Android. Nenhuma cobrança foi criada.', 'ATESTADO_ANDROID_INVALIDO'); }
}
