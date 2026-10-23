import { localDate, validarDia } from './datas.js';
function validarObjetoSeguro(valor, profundidade = 0) {
  if (profundidade > 30) throw new Error('Backup com estrutura muito profunda.');
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return;
  if (typeof valor === 'number') { if (!Number.isFinite(valor)) throw new Error('Número inválido no backup.'); return; }
  if (!valor || typeof valor !== 'object') throw new Error('Valor inválido no backup.');
  for (const [chave, conteudo] of Object.entries(valor)) {
    if (/^(?:__proto__|constructor|prototype)$/i.test(chave) || /(?:api.?key|password|senha|secret|access.?token|refresh.?token)/i.test(chave)) throw new Error('Backup contém campo proibido.');
    validarObjetoSeguro(conteudo, profundidade + 1);
  }
}
export function validarDadosIntegrais(dados) {
  validarObjetoSeguro(dados);
  if (!dados || !['meals', 'weights', 'water'].every(nome => Array.isArray(dados[nome]))) throw new Error('Coleções ausentes no backup.');
  for (const nome of ['meals', 'weights', 'water']) {
    const chaves = new Set();
    for (const registro of dados[nome]) {
      if (!registro || typeof registro !== 'object' || Array.isArray(registro)) throw new Error('Registro inválido.');
      const chave = nome === 'meals' ? registro.id : registro.date;
      if ((typeof chave !== 'string' && typeof chave !== 'number') || chaves.has(chave)) throw new Error('Identificadores ausentes ou repetidos.');
      chaves.add(chave);
      if (nome === 'meals') {
        if(!Number.isSafeInteger(registro.id)||registro.id<1)throw new Error('Identificador de refeição inválido.');
        if (!Number.isFinite(Date.parse(registro.createdAt)) || !Array.isArray(registro.alimentos) || !registro.alimentos.length || !registro.total) throw new Error('Refeição incompleta.');
        registro.dia = registro.dia ? validarDia(registro.dia) : localDate(registro.createdAt);
        for (const alimento of registro.alimentos) {
          if (typeof alimento.nome !== 'string' || !alimento.nome.trim()) throw new Error('Alimento inválido.');
          for (const campo of ['porcao_estimada_g', 'quantidade_g', 'peso_g', 'gramas', 'calorias', 'proteina_g', 'carboidrato_g', 'gordura_g']) if (alimento[campo] !== undefined && (!Number.isFinite(alimento[campo]) || alimento[campo] < 0)) throw new Error('Nutriente inválido.');
        }
        for (const valor of Object.values(registro.total)) if (!Number.isFinite(valor) || valor < 0) throw new Error('Total inválido.');
        if (registro.imagemRemota !== undefined && (typeof registro.imagemRemota !== 'string' || !registro.imagemRemota || registro.imagemRemota.length > 256 || [...registro.imagemRemota].some(caractere => caractere.charCodeAt(0) < 32 || caractere === '/' || caractere.charCodeAt(0) === 92))) throw new Error('Referência de imagem inválida.');
        if (registro.imageDataUrl && !/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=\s]+$/i.test(registro.imageDataUrl)) throw new Error('Imagem de backup inválida.');
      } else {
        validarDia(registro.date);
        const campos = nome === 'weights' ? ['peso_kg'] : ['ml_consumidos', 'ml_por_copo', 'meta_ml'];
        for (const campo of campos) if (!Number.isFinite(registro[campo]) || registro[campo] < 0 || (campo !== 'ml_consumidos' && registro[campo] === 0)) throw new Error('Peso ou água inválido.');
      }
    }
  }
  if (dados.metas !== undefined && dados.metas !== null) {
    if (typeof dados.metas !== 'object' || Array.isArray(dados.metas)) throw new Error('Metas inválidas.');
    for (const valor of Object.values(dados.metas)) if (!Number.isFinite(valor) || valor <= 0) throw new Error('Meta inválida.');
  }
  for (const nome of ['perfil', 'plano', 'preferencias', 'notificacoes']) if (dados[nome] !== undefined && dados[nome] !== null && (typeof dados[nome] !== 'object' || Array.isArray(dados[nome]))) throw new Error('Preferência inválida.');
  return dados;
}



