import teste from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ajustarPorcao, somarNutrientes, validarPerfil, validarPlano, validarAnalise, normalizarRestricoes } from '../www/js/nutricao.js';
import { consultarCorrespondenciaTaco, possuiNutrientesTaco, buscarValidacaoTaco } from '../www/js/tacoSearch.js';
import { getAlternatives, criarSubstituicao } from '../www/js/foodAlternatives.js';

const base = JSON.parse(await readFile(new URL('../www/data/taco.json', import.meta.url)));
const alimento = { nome: 'Teste', porcao_estimada_g: 100, calorias: 100, proteina_g: 5, carboidrato_g: 15, gordura_g: 2 };
const perfil = { idade: 30, sexo: 'feminino', pesoAtual: 65, altura: 165, nivelAtividade: 'leve', objetivo: 'manter_peso', restricoes: [], refeicoesPorDia: 4 };
const plano = { tdee: 100, metaCalorica: 100, macros: { proteina: 5, carboidrato: 15, gordura: 2 }, refeicoes: [{ nome: 'Exemplo fictício', horario: '12:00', kcalEstimada: 100, itens: [{ ...alimento, alimento: alimento.nome, quantidade: '100g', categoria: 'carboidrato' }] }] };

teste('TACO sem nutrientes não substitui uma estimativa por null/zero',async contexto=>{
  const leite=consultarCorrespondenciaTaco('leite de vaca integral',base).alimento;
  assert.equal(leite.id,458);assert.equal(leite.nutrientesDisponiveis,false);
  assert.equal(possuiNutrientesTaco({...base[0],calorias:null}),false);
  assert.equal(possuiNutrientesTaco({...base[0],gordura_g:NaN}),false);
  assert.equal(possuiNutrientesTaco(base[0]),true);
  contexto.mock.method(globalThis,'fetch',async()=>Response.json(base));
  assert.equal(await buscarValidacaoTaco('leite de vaca integral'),null);
});

teste('análise sem marca mantém contrato JSON, sem propriedades undefined no IndexedDB',()=>{
  const analise=validarAnalise({alimentos:[alimento],total:somarNutrientes([alimento])});
  assert.equal(Object.hasOwn(analise.alimentos[0],'marca_identificada'),false);
  assert.deepEqual(JSON.parse(JSON.stringify(analise)),analise);
});

teste('porções 50/100/150/200 g e alterações repetidas não escalam duas vezes', () => {
  for (const gramas of [50, 100, 150, 200]) {
    const ajustado = ajustarPorcao(alimento, gramas);
    assert.equal(ajustado.calorias, gramas);
    assert.equal(somarNutrientes([ajustado]).calorias, gramas);
    assert.equal(ajustarPorcao(ajustado, 200).calorias, 200);
    assert.equal(ajustarPorcao(ajustarPorcao(ajustado, 150), 50).calorias, 50);
  }
});

teste('base completa: 597 nomes exatos preservam identidade, preparo e nutrientes', () => {
  assert.equal(base.length, 597);
  for (const entrada of base) {
    const resultado = consultarCorrespondenciaTaco(entrada.nome, base);
    assert.equal(resultado.alimento?.id, entrada.id, entrada.nome);
    assert.equal(resultado.confianca, 'exata');
    assert.equal(resultado.alimento.calorias, entrada.calorias);
  }
});

teste('referência TACO mantém precisão ao comparar entrada direta e porção editada',()=>{
  const referencia={...base[0],porcao_estimada_g:100};
  const direto=ajustarPorcao(referencia,200);
  const editado=ajustarPorcao(ajustarPorcao(referencia,100),200);
  assert.equal(direto.calorias,editado.calorias);
  assert.equal(direto.calorias,Math.round(base[0].calorias*2*100)/100);
});

teste('consultas ambíguas recusam casamento arbitrário, integral preservado', () => {
  assert.equal(consultarCorrespondenciaTaco('arroz integral cozido', base).alimento.id, 1);
  for (const nome of ['arroz branco cozido', 'arroz cozido', 'frango grelhado', 'feijão cozido', 'frango', 'comida']) assert.equal(consultarCorrespondenciaTaco(nome, base).alimento, null, nome);
  assert.equal(consultarCorrespondenciaTaco('peito de frango sem pele grelhado', base).alimento.id, 410);
  assert.equal(consultarCorrespondenciaTaco('frango peito sem pele cru', base).alimento.id, 409);
  assert.ok(consultarCorrespondenciaTaco('feijão cozido', base).sugestoes.length > 0);
});

teste('restrições canônicas e filtros conservadores em todas categorias', () => {
  assert.deepEqual(normalizarRestricoes(['vegan', 'sem_gluten', 'lactose']), ['vegano', 'sem_gluten', 'sem_lactose']);
  for (const categoria of ['proteina', 'carboidrato', 'vegetal', 'fruta', 'laticinio', 'gordura', 'bebida', 'condimento', 'outro']) {
    const veganos = getAlternatives(categoria, { restricoes: ['vegano'] });
    assert.ok(veganos.every(nome => !/Frango|Ovo|Queijo/.test(nome)));
    assert.ok(getAlternatives(categoria, { restricoes: ['vegetariano'] }).every(nome => !/Frango/.test(nome)));
    for (const restricao of ['sem_gluten', 'sem_lactose', 'desconhecida']) assert.deepEqual(getAlternatives(categoria, { restricoes: [restricao] }), []);
    assert.deepEqual(getAlternatives(categoria, { restricoesTexto: 'amendoim' }), []);
    assert.deepEqual(getAlternatives(categoria, { alergias: 'soja' }), []);
  }
  assert.ok(!getAlternatives('proteina', { alimentosNaoGosta: 'frango' }).some(nome => /Frango/.test(nome)));
});

teste('esquemas rejeitam negativos, não finitos, JSON incompleto e somas incompatíveis', () => {
  for (const invalido of [-1, NaN, Infinity, '100']) {
    assert.throws(() => ajustarPorcao(alimento, invalido));
    assert.throws(() => validarAnalise({ alimentos: [{ ...alimento, calorias: invalido }], total: somarNutrientes([alimento]) }));
  }
  assert.throws(() => validarAnalise({ alimentos: [alimento], total: { ...somarNutrientes([alimento]), calorias: 500 } }));
  assert.throws(() => validarPlano({}));
  assert.equal(validarPlano(plano).estado, 'rascunho_para_revisao_profissional');
  assert.throws(() => validarPlano({ ...plano, metaCalorica: -600 }));
  assert.throws(() => validarPlano({ ...plano, macros: { ...plano.macros, proteina: 300 } }));
  assert.throws(() => validarPlano({ ...plano, refeicoes: [{ ...plano.refeicoes[0], kcalEstimada: 400 }] }));
});

teste('perfil adulto, condições e gestação bloqueiam automático sem inventar indicação clínica', () => {
  assert.equal(validarPerfil(perfil).idade, 30);
  for (const alteracao of [{ idade: 17 }, { idade: 121 }, { idade: -1 }, { pesoAtual: -5 }, { altura: -10 }, { gestante: true }, { gestante: true, acompanhamentoProfissional: true }, { condicoesSaude: 'diabetes' }, { refeicoesPorDia: 2.5 }]) assert.throws(() => validarPerfil({ ...perfil, ...alteracao }));
  assert.equal(validarPerfil({ ...perfil, condicoesSaude: 'diabetes' }, { paraPlano: false }).condicoesSaude, 'diabetes');
});

teste('substituição usa nutrientes novos e equivalência energética explícita', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => base });
  try {
    const resultado = await criarSubstituicao({ ...alimento, alimento: 'Arroz', categoria: 'carboidrato' }, 'Batata, doce, cozida', {});
    assert.ok(Math.abs(resultado.calorias - alimento.calorias) < 0.1);
    assert.notEqual(resultado.proteina_g, alimento.proteina_g);
    assert.equal(resultado.equivalencia, 'energia_apenas');
    assert.equal(resultado.revisaoNecessaria, true);
    await assert.rejects(criarSubstituicao({ alimento: 'Legado', categoria: 'carboidrato' }, 'Batata, doce, cozida', {}));
    await assert.rejects(criarSubstituicao({ ...alimento, categoria: 'proteina' }, 'Frango, peito, sem pele, grelhado', { restricoes: ['vegano'] }));
  } finally { globalThis.fetch = originalFetch; }
});
import { buildPrompt, minimizarPerfil } from '../www/js/promptPlano.js';

teste('prompt separa alergias de preferências e omite dados livres desnecessários', () => {
  const dados = { ...perfil, restricoesTexto: 'amendoim', alimentosNaoGosta: 'berinjela', rotinaTexto: 'Nome pessoal e endereço desnecessários' };
  const prompt = buildPrompt(dados);
  assert.match(prompt, /Alergias: "amendoim"/);
  assert.match(prompt, /Alimentos não apreciados: "berinjela"/);
  assert.ok(!prompt.includes('Nome pessoal'));
  assert.ok(!('rotinaTexto' in minimizarPerfil(dados)));
});
import { requisitarIa, analyzeText, analyzeImage } from '../www/js/visionApi.js';
import { consultarSessao } from '../www/js/servicoHttp.js';

teste('IA usa sessão servidor e timeout cobre leitura do corpo, além de cancelamento', async () => {
  const originalFetch = globalThis.fetch;
  const armazenamentoOriginal=globalThis.localStorage;
  const pendencias=new Map();
  globalThis.localStorage={getItem:chave=>pendencias.get(chave)??null,setItem:(chave,valor)=>pendencias.set(chave,valor),removeItem:chave=>pendencias.delete(chave)};
  const chamadas = [];
  globalThis.fetch = async (caminho, opcoes) => {
    chamadas.push({ caminho, opcoes });
    if (caminho === '/api/conta') return { ok: true, json: async () => ({ csrf: 'token-ficticio',usuario:{id:'11111111-1111-4111-8111-111111111111'} }) };
    return { ok: true, json: () => new Promise((resolver, rejeitar) => {
      if (opcoes.signal.aborted) rejeitar(new DOMException('Cancelado', 'AbortError'));
      else opcoes.signal.addEventListener('abort', () => rejeitar(new DOMException('Cancelado', 'AbortError')), { once: true });
    }) };
  };
  try {
    await consultarSessao();
    // Permite preparar a intenção criptográfica sob carga antes de testar o corpo pendente.
    await assert.rejects(requisitarIa({ tipo: 'plano' }, { prazoMs: 500 }), /Tempo esgotado/);
    const cancelador = new AbortController();
    const requisicao = requisitarIa({ tipo: 'plano' }, { signal: cancelador.signal, prazoMs: 100 });
    cancelador.abort();
    await assert.rejects(requisicao, /cancelada/);
    assert.equal(chamadas[1].caminho, '/api/ia');
    assert.equal(chamadas[1].opcoes.credentials, 'same-origin');
    assert.equal(chamadas[1].opcoes.headers['X-CSRF-Token'], 'token-ficticio');
    assert.ok(chamadas[1].opcoes.headers['X-Idempotency-Key']);
    assert.ok(!('Authorization' in chamadas[1].opcoes.headers));
    await assert.rejects(analyzeText({ nome: 'arroz', gramas: -1 }), /quantidade/);
    await assert.rejects(analyzeImage({ base64: 'invalido!', mediaType: 'image/jpeg' }), /Imagem inválida/);
  } finally { globalThis.fetch = originalFetch;if(armazenamentoOriginal===undefined)delete globalThis.localStorage;else globalThis.localStorage=armazenamentoOriginal; }
});

teste('metadados de simulação e discrepâncias de energia permanecem visíveis sem inferir critérios clínicos', () => {
  const inconsistente = { ...alimento, calorias: 500 };
  const recebido = validarAnalise({ alimentos: [inconsistente], total: somarNutrientes([inconsistente]), simulado: true });
  assert.equal(recebido.simulado, true);
  assert.equal(recebido.revisaoNecessaria, true);
  assert.ok(recebido.avisos.length);
  assert.throws(() => normalizarRestricoes(['constructor']), /desconhecida/);
  assert.throws(() => normalizarRestricoes(['toString']), /desconhecida/);
});
import { validarPedidoIA, executarIA } from '../servidor/ia.js';

teste('servidor recusa restrições e alergias antes do provedor mesmo no modo simulado', async () => {
  const configuracao = { simulado: true, ambiente: {} };
  for (const restricao of ['vegano', 'vegetariano', 'sem_gluten', 'sem_lactose']) assert.throws(() => validarPedidoIA({ tipo: 'plano', perfil: { ...perfil, restricoes: [restricao] } }, configuracao), /validação profissional/);
  assert.throws(() => validarPedidoIA({ tipo: 'plano', perfil: { ...perfil, restricoesTexto: 'amendoim' } }, configuracao), /Alergias/);
  assert.throws(() => validarPedidoIA({ tipo: 'plano', perfil }, { simulado: false, ambiente: {} }), /homologação/);
  assert.throws(() => validarPedidoIA({ tipo: 'texto', texto: 'arroz', gramas: -200 }, configuracao), /quantidade/);
  const pedido = validarPedidoIA({ tipo: 'texto', texto: 'arroz', gramas: 200 }, configuracao);
  const resultado = await executarIA(pedido, configuracao);
  assert.equal(resultado.alimentos[0].porcao_estimada_g, 200);
  assert.equal(resultado.total.calorias, 248);
  assert.equal(resultado.simulado, true);
});
