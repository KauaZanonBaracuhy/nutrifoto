import { completarFotosDoBackup } from './imagensRemotas.js';
import { validarPerfil, validarPlano, validarAnalise } from './nutricao.js';
import { lerDadosIntegrais, substituirDadosIntegrais } from './db.js';
import { obterChaveLocal } from './storage.js';
import { validarDadosIntegrais } from './dadosValidacao.js';
export { validarDadosIntegrais } from './dadosValidacao.js';
const PREFERENCIAS = { metas: 'goals', perfil: 'userProfile', plano: 'currentPlan', preferencias: 'preferences', tema: 'theme', notificacoes: 'notify', tutorial: 'onboardingCompleto' };
export function lerPreferencias() {
  const resultado = {};
  for (const [nome, chave] of Object.entries(PREFERENCIAS)) {
    const valor = localStorage.getItem(obterChaveLocal(`nutrifoto.${chave}`));
    try { resultado[nome] = valor === null ? null : JSON.parse(valor); }
    catch { resultado[nome] = valor; }
  }
  return resultado;
}
function prepararPreferencias(dados) {
  return Object.entries(PREFERENCIAS).map(([nome, chave]) => {
    const valor = dados[nome];
    return [obterChaveLocal(`nutrifoto.${chave}`), valor === undefined || valor === null ? null : typeof valor === 'string' ? valor : JSON.stringify(valor)];
  });
}
function omitirCamposAusentes(valor,profundidade=0){
  if(profundidade>30)throw new Error('Backup com estrutura muito profunda.');
  if(Array.isArray(valor))return valor.map(item=>omitirCamposAusentes(item,profundidade+1));
  if(!valor||typeof valor!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(valor)))return valor;
  // JSON não representa propriedades undefined. Omitir não altera o registro original,
  // nem converte NaN, null ou nutrientes ausentes em valores nutricionais válidos.
  return Object.fromEntries(Object.entries(valor).filter(([,conteudo])=>conteudo!==undefined).map(([chave,conteudo])=>[chave,omitirCamposAusentes(conteudo,profundidade+1)]));
}
export async function exportarBackupIntegral() {
  const dados = omitirCamposAusentes({ ...await lerDadosIntegrais(), ...lerPreferencias() });
  const arquivosLegados=[...(dados.preferencias?.registrosParaRevisao||[])];
  dados.meals=dados.meals.filter(refeicao=>{try{validarAnalise(refeicao);return true;}catch{arquivosLegados.push({tipo:'refeicao',dados:refeicao});return false;}});
  if(dados.perfil){try{validarPerfil(dados.perfil,{paraPlano:false});}catch{arquivosLegados.push({tipo:'perfil',dados:dados.perfil});dados.perfil=null;}}
  if(dados.plano){try{validarPlano(dados.plano);}catch{arquivosLegados.push({tipo:'plano',dados:dados.plano});dados.plano=null;}}
  if(dados.metas&&Object.values(dados.metas).some(valor=>!Number.isFinite(valor)||valor<=0)){arquivosLegados.push({tipo:'metas',dados:dados.metas});dados.metas=null;}
  if(arquivosLegados.length)dados.preferencias={...dados.preferencias,registrosParaRevisao:[...new Map(arquivosLegados.map(registro=>[JSON.stringify(registro),registro])).values()]};
  validarDadosIntegrais(dados);
  await completarFotosDoBackup(dados);
  return { formato: 'nutrifoto.backup', versao: 1, criadoEm: new Date().toISOString(), dados };
}
export function mesclarDadosIntegrais(locais, recebidos, conflito = 'local') {
  if (!['local', 'backup'].includes(conflito)) throw new Error('Escolha como resolver conflitos.');
  const prioritario = conflito === 'local' ? locais : recebidos;
  const secundario = conflito === 'local' ? recebidos : locais;
  const resultado = { ...secundario, ...prioritario };
  for (const campo of Object.keys(PREFERENCIAS)) resultado[campo] = prioritario[campo] ?? secundario[campo] ?? null;
  const arquivos=[...(secundario.preferencias?.registrosParaRevisao||[]),...(prioritario.preferencias?.registrosParaRevisao||[])];
  if(arquivos.length)resultado.preferencias={...resultado.preferencias,registrosParaRevisao:[...new Map(arquivos.map(registro=>[JSON.stringify(registro),registro])).values()]};
  for (const nome of ['meals', 'weights', 'water']) {
    const chave = nome === 'meals' ? 'id' : 'date';
    const registros = new Map(secundario[nome].map(registro => [registro[chave], registro]));
    for (const registro of prioritario[nome]) registros.set(registro[chave], registro);
    resultado[nome] = [...registros.values()];
  }
  return resultado;
}
export async function restaurarDadosIntegrais(dados) {
  validarDadosIntegrais(dados);
  const preferencias = prepararPreferencias(dados);
  const anteriores = preferencias.map(([chave]) => [chave, localStorage.getItem(chave)]);
  try {
    await substituirDadosIntegrais(dados, () => {
      for (const [chave, valor] of preferencias) valor === null ? localStorage.removeItem(chave) : localStorage.setItem(chave, valor);
    });
  } catch (erro) {
    for (const [chave, valor] of anteriores) valor === null ? localStorage.removeItem(chave) : localStorage.setItem(chave, valor);
    throw erro;
  }
}
export async function importarBackupIntegral(arquivo, { modo, conflito } = {}) {
  const backup = typeof arquivo === 'string' ? JSON.parse(arquivo) : structuredClone(arquivo);
  if (backup?.formato !== 'nutrifoto.backup' || backup.versao !== 1) throw new Error('Formato ou versão do backup não suportado.');
  if (!['substituir', 'mesclar'].includes(modo)) throw new Error('Escolha substituir ou mesclar antes de restaurar.');
  let dados = validarDadosIntegrais(backup.dados);
  for(const refeicao of dados.meals)validarAnalise(refeicao);
  for (const refeicao of dados.meals) {
    if (refeicao.imagemRemota && !refeicao.imageDataUrl) throw new Error('Backup sem a foto original. Exporte novamente com acesso às imagens.');
    delete refeicao.imagemRemota;
  }
  if (dados.perfil) validarPerfil(dados.perfil, { paraPlano: false });
  if (dados.plano) validarPlano(dados.plano);
  if (modo === 'mesclar') dados = mesclarDadosIntegrais((await exportarBackupIntegral()).dados, dados, conflito);
  await restaurarDadosIntegrais(dados);
  return { refeicoes: dados.meals.length, pesos: dados.weights.length, agua: dados.water.length };
}





