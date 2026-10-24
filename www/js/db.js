import { receberImagemRemota } from './imagensRemotas.js';
import { validarAnalise } from './nutricao.js';
import { localDate, validarDia, deslocarDia } from './datas.js';
import { definirContaArmazenamento, obterContaArmazenamento } from './storage.js';
import { autorizarAcompanhamento } from './licenca.js';
export { localDate } from './datas.js';
const VERSAO = 4;
const COLECOES = ['meals', 'weights', 'water', 'resumos'];
let nomeBanco = 'nutrifoto';
let promessaBanco;
export function definirContaLocal(id) {
  if (obterContaArmazenamento() !== (id ? String(id) : null) && typeof window !== 'undefined') window.dispatchEvent(new Event('nutrifoto:troca-conta'));
  const anterior = promessaBanco;
  nomeBanco = id ? `nutrifoto.conta.${encodeURIComponent(String(id))}` : 'nutrifoto';
  promessaBanco = undefined;
  anterior?.then(banco => banco.close()).catch(() => {});
  definirContaArmazenamento(id);
}
function resumoRefeicao(refeicao) {
  const { image, imageData, imageBase64, imageDataUrl, photo, photoData, ...resumo } = refeicao;
  try{validarAnalise(refeicao);}catch{resumo.legadoIncompleto=true;}
  return resumo;
}
function abrirBanco() {
  if (promessaBanco) return promessaBanco;
  promessaBanco = new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(nomeBanco, VERSAO);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      const transacao = pedido.transaction;
      if (!banco.objectStoreNames.contains('sincronizacao')) banco.createObjectStore('sincronizacao', { keyPath: 'id' });
      for (const nome of COLECOES) {
        if (!banco.objectStoreNames.contains(nome)) banco.createObjectStore(nome, nome === 'meals' ? { keyPath: 'id', autoIncrement: true } : { keyPath: nome === 'resumos' ? 'id' : 'date' });
      }
      for (const nome of ['meals', 'resumos']) {
        const colecao = transacao.objectStore(nome);
        if (!colecao.indexNames.contains('dia')) colecao.createIndex('dia', 'dia');
        if (nome === 'meals' && !colecao.indexNames.contains('chaveOperacao')) colecao.createIndex('chaveOperacao', 'chaveOperacao', { unique: true });
      }
      const cursor = transacao.objectStore('meals').openCursor();
      cursor.onsuccess = () => {
        const atual = cursor.result;
        if (!atual) return;
        const registro = { ...atual.value, dia: atual.value.dia || localDate(atual.value.createdAt), schema: 4 };
        atual.update(registro);
        transacao.objectStore('resumos').put(resumoRefeicao(registro));
        atual.continue();
      };
    };
    pedido.onsuccess = () => {
      pedido.result.onversionchange = () => pedido.result.close();
      resolver(pedido.result);
    };
    pedido.onerror = () => { promessaBanco = undefined; rejeitar(pedido.error); };
    pedido.onblocked = () => rejeitar(new Error('Feche outras abas para atualizar o armazenamento.'));
  });
  return promessaBanco;
}
function aguardarPedido(pedido) {
  return new Promise((resolver, rejeitar) => { pedido.onsuccess = () => resolver(pedido.result); pedido.onerror = () => rejeitar(pedido.error); });
}
async function executarTransacao(nomes, modo, executar) {
  const banco = await abrirBanco();
  const transacao = banco.transaction(nomes, modo);
  const finalizada = new Promise((resolver, rejeitar) => {
    transacao.oncomplete = resolver;
    transacao.onabort = transacao.onerror = () => rejeitar(transacao.error || new Error('Operação não concluída.'));
  });
  try {
    const resultado = await executar(transacao);
    await finalizada;
    return resultado;
  } catch (erro) {
    try { transacao.abort(); } catch {}
    await finalizada.catch(() => {});
    throw erro;
  }
}
function percorrer(fonte, intervalo, direcao = 'next', limite = Infinity) {
  return new Promise((resolver, rejeitar) => {
    const registros = [];
    const pedido = fonte.openCursor(intervalo, direcao);
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor || registros.length >= limite) { resolver(registros); return; }
      registros.push(cursor.value);
      cursor.continue();
    };
  });
}
function validarRefeicao(refeicao) {
  validarAnalise(refeicao);
  if (!refeicao || !Array.isArray(refeicao.alimentos) || !refeicao.alimentos.length) throw new Error('Refeição sem alimentos.');
  for (const alimento of refeicao.alimentos) {
    if (typeof alimento.nome !== 'string' || !alimento.nome.trim()) throw new Error('Alimento sem nome.');
    for (const campo of ['porcao_estimada_g', 'quantidade_g', 'peso_g', 'gramas', 'calorias', 'proteina_g', 'carboidrato_g', 'gordura_g']) {
      if (alimento[campo] !== undefined && (!Number.isFinite(alimento[campo]) || alimento[campo] < 0)) throw new Error('Quantidade ou nutriente inválido.');
    }
  }
  for (const valor of Object.values(refeicao.total || {})) if (!Number.isFinite(valor) || valor < 0) throw new Error('Total inválido.');
  if (refeicao.createdAt && !Number.isFinite(Date.parse(refeicao.createdAt))) throw new Error('Instante inválido.');
}
export async function salvarRefeicao(refeicao) {
  validarRefeicao(refeicao);
  // A mesma intenção mantém sua chave mesmo quando dois eventos a salvam juntos.
  if (!refeicao.chaveOperacao) refeicao.chaveOperacao = crypto.randomUUID();
  return executarTransacao(['meals', 'resumos'], 'readwrite', async transacao => {
    const colecao = transacao.objectStore('meals');
    const existente = await aguardarPedido(colecao.index('chaveOperacao').get(refeicao.chaveOperacao));
    if (existente) return existente;
    const aleatorios = crypto.getRandomValues(new Uint32Array(2));
    const identificador = (aleatorios[0] & 0xfffff) * 4294967296 + aleatorios[1];
    const registro = { ...refeicao, id: refeicao.id ?? identificador, createdAt: refeicao.createdAt || new Date().toISOString(), schema: 4 };
    registro.dia = refeicao.dia ? validarDia(refeicao.dia) : localDate(registro.createdAt);
    registro.id = await aguardarPedido(colecao.add(registro));
    await aguardarPedido(transacao.objectStore('resumos').put(resumoRefeicao(registro)));
    return registro;
  });
}
export async function obterRefeicao(id) {
  const conta = obterContaArmazenamento();
  const registro = await executarTransacao(['meals'], 'readonly', transacao => aguardarPedido(transacao.objectStore('meals').get(id)));
  if (registro?.imagemRemota && !registro.imageDataUrl) {
    const imagem = await receberImagemRemota(registro.imagemRemota);
    if (obterContaArmazenamento() !== conta) throw new Error('A conta mudou ao carregar a foto.');
    registro.imageDataUrl = imagem;
    await executarTransacao(['meals'], 'readwrite', transacao => aguardarPedido(transacao.objectStore('meals').put(registro)));
  }
  return registro;
}
export async function registrarImagemRemota(id, imagemRemota) {
  return executarTransacao(['meals', 'resumos'], 'readwrite', async transacao => {
    const colecao = transacao.objectStore('meals');
    const registro = await aguardarPedido(colecao.get(id));
    if (!registro) return;
    registro.imagemRemota = imagemRemota;
    await aguardarPedido(colecao.put(registro));
    await aguardarPedido(transacao.objectStore('resumos').put(resumoRefeicao(registro)));
  });
}
export async function atualizarRefeicao(id, refeicao) {
  validarRefeicao(refeicao);
  return executarTransacao(['meals', 'resumos'], 'readwrite', async transacao => {
    const colecao = transacao.objectStore('meals');
    const anterior = await aguardarPedido(colecao.get(id));
    if (!anterior) throw new Error('Refeição não encontrada.');
    const registro = { ...anterior, ...refeicao, id, chaveOperacao: anterior.chaveOperacao, dia: anterior.dia };
    await aguardarPedido(colecao.put(registro));
    await aguardarPedido(transacao.objectStore('resumos').put(resumoRefeicao(registro)));
    return id;
  });
}
export async function deletarRefeicao(id) { return executarTransacao(['meals', 'resumos'], 'readwrite', async transacao => { await aguardarPedido(transacao.objectStore('meals').delete(id)); await aguardarPedido(transacao.objectStore('resumos').delete(id)); }); }
export async function listarRefeicoesDoDia(dia = localDate()) {
  return executarTransacao(['resumos'], 'readonly', transacao => percorrer(transacao.objectStore('resumos').index('dia'), IDBKeyRange.only(localDate(dia))));
}
export async function listarHistorico({ antesDe, limiteDias = 30 } = {}) {
  if (!Number.isInteger(limiteDias) || limiteDias < 1 || limiteDias > 365) throw new Error('Limite de histórico inválido.');
  return executarTransacao(['resumos'], 'readonly', transacao => new Promise((resolver, rejeitar) => {
    const grupos = [];
    const intervalo = antesDe ? IDBKeyRange.upperBound(validarDia(antesDe), true) : undefined;
    const pedido = transacao.objectStore('resumos').index('dia').openCursor(intervalo, 'prev');
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) { resolver(grupos); return; }
      let grupo = grupos[grupos.length - 1];
      if (!grupo || grupo.day !== cursor.value.dia) {
        if (grupos.length === limiteDias) { resolver(grupos); return; }
        grupo = { day: cursor.value.dia, meals: [] }; grupos.push(grupo);
      }
      grupo.meals.unshift(cursor.value); cursor.continue();
    };
  }));
}
export async function listarTodasRefeicoes() { return executarTransacao(['meals'], 'readonly', transacao => percorrer(transacao.objectStore('meals'))); }
export async function listarTotaisPorDia(dias = 7) {
  if (!Number.isInteger(dias) || dias < 1 || dias > 366) throw new Error('Período inválido.');
  const hoje = localDate(); const inicio = deslocarDia(hoje, -dias + 1);
  const registros = await executarTransacao(['resumos'], 'readonly', transacao => percorrer(transacao.objectStore('resumos').index('dia'), IDBKeyRange.bound(inicio, hoje)));
  return Array.from({ length: dias }, (_, indice) => {
    const dia = deslocarDia(inicio, indice);
    const total = { day: dia, calorias: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 };
    for (const registro of registros) if (registro.dia === dia && !registro.legadoIncompleto) for (const campo of Object.keys(total).filter(campo => campo !== 'day')) total[campo] += registro.total?.[campo] || 0;
    return total;
  });
}
export async function obterStreak() {
  const hoje = localDate();
  return executarTransacao(['resumos'], 'readonly', transacao => new Promise((resolver, rejeitar) => {
    let esperado = hoje;
    let total = 0;
    const pedido = transacao.objectStore('resumos').index('dia').openKeyCursor(IDBKeyRange.upperBound(hoje), 'prevunique');
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) { resolver(total); return; }
      if (total === 0 && esperado === hoje && cursor.key === deslocarDia(hoje, -1)) esperado = cursor.key;
      if (cursor.key !== esperado) { resolver(total); return; }
      total++; esperado = deslocarDia(esperado, -1); cursor.continue();
    };
  }));
}export async function salvarPeso(peso_kg, dia = localDate()) {
  await autorizarAcompanhamento();
  if (!Number.isFinite(peso_kg) || peso_kg <= 0 || peso_kg > 1000) throw new Error('Peso inválido.');
  const registro = { date: validarDia(dia), peso_kg, createdAt: new Date().toISOString() };
  await executarTransacao(['weights'], 'readwrite', transacao => aguardarPedido(transacao.objectStore('weights').put(registro)));
  return registro;
}
export async function listarPesos(dias) {
  const intervalo = dias ? IDBKeyRange.lowerBound(deslocarDia(localDate(), -dias + 1)) : undefined;
  return executarTransacao(['weights'], 'readonly', transacao => percorrer(transacao.objectStore('weights'), intervalo));
}
async function obterUltimosPesos() { return executarTransacao(['weights'], 'readonly', transacao => percorrer(transacao.objectStore('weights'), undefined, 'prev', 2)); }
export async function obterPesoMaisRecente() { return (await obterUltimosPesos())[0] || null; }
export async function obterPesoAnterior() { return (await obterUltimosPesos())[1] || null; }
export async function obterAguaHoje() { const dia = localDate(); return (await executarTransacao(['water'], 'readonly', transacao => aguardarPedido(transacao.objectStore('water').get(dia)))) || { date: dia, ml_consumidos: 0, ml_por_copo: 250, meta_ml: 2000 }; }
async function alterarAgua(quantidade, meta) {
  await autorizarAcompanhamento();
  if (!Number.isFinite(quantidade) || Math.abs(quantidade) > 10000 || (meta !== undefined && (!Number.isFinite(meta) || meta <= 0 || meta > 20000))) throw new Error('Volume de água inválido.');
  return executarTransacao(['water'], 'readwrite', async transacao => {
    const colecao = transacao.objectStore('water'); const dia = localDate();
    const anterior = await aguardarPedido(colecao.get(dia));
    const registro = { date: dia, ml_consumidos: Math.max(0, (anterior?.ml_consumidos || 0) + quantidade), ml_por_copo: Math.abs(quantidade) || anterior?.ml_por_copo || 250, meta_ml: meta ?? anterior?.meta_ml ?? 2000, createdAt: new Date().toISOString() };
    await aguardarPedido(colecao.put(registro)); return registro;
  });
}
export function adicionarCopo(quantidade = 250) { if (quantidade <= 0) throw new Error('Volume inválido.'); return alterarAgua(quantidade); }
export function removerCopo(quantidade = 250) { if (quantidade <= 0) throw new Error('Volume inválido.'); return alterarAgua(-quantidade); }
export function atualizarMetaAgua(meta) { return alterarAgua(0, meta); }
export async function lerDadosIntegrais() {
  return executarTransacao(['meals', 'weights', 'water'], 'readonly', async transacao => {
    const pedidos = ['meals', 'weights', 'water'].map(nome => percorrer(transacao.objectStore(nome)));
    const [meals, weights, water] = await Promise.all(pedidos);
    return { meals, weights, water };
  });
}
export async function substituirDadosIntegrais(dados, atualizarPreferencias) {
  return executarTransacao(COLECOES, 'readwrite', async transacao => {
    for (const nome of COLECOES) transacao.objectStore(nome).clear();
    for (const nome of ['meals', 'weights', 'water']) for (const registro of dados[nome]) {
      transacao.objectStore(nome).put(registro);
      if (nome === 'meals') transacao.objectStore('resumos').put(resumoRefeicao(registro));
    }
    atualizarPreferencias?.();
  });
}

export function lerEstadoRemoto() { return executarTransacao(['sincronizacao'], 'readonly', transacao => aguardarPedido(transacao.objectStore('sincronizacao').get('atual'))).then(estado => estado || { revisao: 0 }); }
export function gravarEstadoRemoto(estado) { return executarTransacao(['sincronizacao'], 'readwrite', transacao => aguardarPedido(transacao.objectStore('sincronizacao').put({ ...estado, id: 'atual' }))); }

export async function apagarDadosLocais() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nutrifoto:troca-conta'));
  const conta = obterContaArmazenamento();
  const prefixo = conta ? `nutrifoto.conta.${encodeURIComponent(conta)}.` : 'nutrifoto.';
  const chaves = Object.keys(localStorage).filter(chave => chave.startsWith(prefixo) && (conta || !chave.startsWith('nutrifoto.conta.')));
  const anteriores = chaves.map(chave => [chave, localStorage.getItem(chave)]);
  try {
    await executarTransacao([...COLECOES, 'sincronizacao'], 'readwrite', transacao => {
      for (const nome of [...COLECOES, 'sincronizacao']) transacao.objectStore(nome).clear();
      for (const chave of chaves) localStorage.removeItem(chave);
    });
  } catch (erro) {
    for (const [chave, valor] of anteriores) localStorage.setItem(chave, valor);
    throw erro;
  }
}
