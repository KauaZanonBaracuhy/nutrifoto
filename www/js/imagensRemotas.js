import { obterContaArmazenamento } from './storage.js';
import { requisitarApi } from './servicoHttp.js';
export async function enviarImagemRemota(dataUrl, sinal) {
  const resposta = await requisitarApi('/api/imagens', { method: 'POST', body: JSON.stringify({ dataUrl }), signal: sinal });
  if (typeof resposta.id !== 'string' || !resposta.id) throw new Error('Referência da imagem inválida.');
  return resposta.id;
}
export async function receberImagemRemota(id, sinal) {
  const resposta = await requisitarApi(`/api/imagens?id=${encodeURIComponent(id)}`, { signal: sinal });
  if (typeof resposta.dataUrl !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=\s]+$/i.test(resposta.dataUrl)) throw new Error('Imagem remota inválida.');
  return resposta.dataUrl;
}
export function removerFotosDoPacote(dados) {
  return { ...dados, meals: dados.meals.map(refeicao => {
    const { imageDataUrl, ...metadados } = refeicao;
    if (imageDataUrl && !refeicao.imagemRemota) throw new Error('Foto ainda não foi enviada. Seus dados locais foram preservados.');
    return metadados;
  }) };
}
export async function completarFotosDoBackup(dados) {
  const conta = obterContaArmazenamento();
  for (const refeicao of dados.meals) if (refeicao.imagemRemota && !refeicao.imageDataUrl) {
    refeicao.imageDataUrl = await receberImagemRemota(refeicao.imagemRemota);
    if (obterContaArmazenamento() !== conta) throw new Error('A conta mudou durante a exportação.');
  }
  return dados;
}

