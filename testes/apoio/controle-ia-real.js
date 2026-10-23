import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { buscarJson } from '../../servidor/seguranca.js';

export const pastaEvidencias = resolve(import.meta.dirname,'../../evidencias/homologacao-real');
const arquivoControle = resolve(pastaEvidencias,'controle.json');
const MAXIMO_CHAMADAS = 5;
const ORCAMENTO_USD = 0.05;
export const modeloConfigurado = 'openai/gpt-4o-mini';

export function carregarAmbientePrivado(){
  const raiz=resolve(import.meta.dirname,'../..');
  let ambiente={};
  for(const nome of ['.env','.env.local'])if(existsSync(resolve(raiz,nome)))ambiente={...ambiente,...parseEnv(readFileSync(resolve(raiz,nome),'utf8'))};
  return {...ambiente,...process.env};
}
export function lerControle(){
  return existsSync(arquivoControle)?JSON.parse(readFileSync(arquivoControle,'utf8')):{provedor:'OpenRouter',modeloConfigurado,maximoChamadas:MAXIMO_CHAMADAS,orcamentoUsd:ORCAMENTO_USD,chamadas:[],custoConhecidoUsd:0,bloqueado:false};
}
function salvarControle(controle){mkdirSync(pastaEvidencias,{recursive:true});writeFileSync(arquivoControle,JSON.stringify(controle,null,2));}

// Reservar ANTES do envio impede uma repetição de processo de reiniciar o orçamento.
export async function enviarChamadaControlada(caminho,opcoes={},tipo='diagnostico'){
  const controle=lerControle();
  if(controle.bloqueado||controle.encerrada||controle.chamadas.some(item=>item.estado==='reservada')||controle.chamadas.length>=MAXIMO_CHAMADAS)throw new Error('Rodada real interrompida pelo controle de chamadas/custos.');
  if(!['key','models','chat/completions'].includes(caminho))throw new Error('Endpoint de homologação não autorizado.');
  if(caminho==='chat/completions'){
    if(!controle.modelo?.disponivel||!controle.autenticacao?.ok)throw new Error('Diagnóstico obrigatório ainda não aprovado.');
    const corpo=JSON.parse(opcoes.body);
    if(corpo.model!==modeloConfigurado||corpo.max_tokens>1500)throw new Error('Modelo/tokens fora do limite da homologação.');
    const precos=controle.modelo.precos;
    const reserva=controle.modelo.contexto*Number(precos.prompt)+corpo.max_tokens*Number(precos.completion)+Number(precos.request||0)+Number(precos.image||0);
    if(!Number.isFinite(reserva)||reserva+controle.custoConhecidoUsd>ORCAMENTO_USD)throw new Error('Não é possível reservar custo conservador dentro do orçamento da rodada.');
  }
  const registro={numero:controle.chamadas.length+1,tipo,inicio:new Date().toISOString(),estado:'reservada'};
  controle.chamadas.push(registro);salvarControle(controle);
  try{
    const resposta=await buscarJson('https://openrouter.ai/api/v1/'+caminho,opcoes,25000,caminho==='models'?8_000_000:2_000_000);
    registro.status=resposta.status;registro.estado=resposta.ok?'respondida':'recusada';
    if(caminho==='key'){
      controle.autenticacao={ok:resposta.ok,status:resposta.status,limiteDefinido:Number.isFinite(resposta.dados.data?.limit),possuiSaldoInformado:resposta.dados.data?.limit_remaining>0};
      if(!resposta.ok)controle.bloqueado=true;
    }
    if(caminho==='models'){
      const modelo=resposta.dados.data?.find(item=>item.id===modeloConfigurado);
      controle.modelo={id:modeloConfigurado,disponivel:!!modelo,contexto:modelo?.context_length,entradas:modelo?.architecture?.input_modalities,precos:modelo?.pricing,parametros:modelo?.supported_parameters};
      if(!resposta.ok||!modelo||!Number.isFinite(Number(modelo.pricing?.prompt))||!Number.isFinite(Number(modelo.pricing?.completion)))controle.bloqueado=true;
    }
    if(caminho==='chat/completions'){
      registro.modeloRetornado=resposta.dados.model;registro.provedorExecucao=resposta.dados.provider;
      registro.uso=resposta.dados.usage;
      const custo=resposta.dados.usage?.cost;
      if(typeof custo==='number'&&Number.isFinite(custo)&&custo>=0)controle.custoConhecidoUsd+=custo;
      else controle.bloqueado=true;
      if(!resposta.ok||resposta.dados.error||controle.custoConhecidoUsd>=ORCAMENTO_USD)controle.bloqueado=true;
      if(resposta.ok&&resposta.dados.choices)writeFileSync(resolve(pastaEvidencias,`resposta-${registro.numero}.json`),JSON.stringify({model:resposta.dados.model,provider:resposta.dados.provider,choices:resposta.dados.choices,usage:resposta.dados.usage},null,2));
    }
    salvarControle(controle);return resposta;
  }catch(erro){registro.estado='falha';registro.codigo=erro.codigo||erro.code||'FALHA_EXTERNA';controle.bloqueado=true;salvarControle(controle);throw new Error('Falha externa: rodada interrompida para evitar repetição de custos.');}
}

export async function prepararDiagnostico(){
  if(!process.argv.includes('--confirmar-chamadas-reais'))throw new Error('Execução real exige a opção explícita --confirmar-chamadas-reais.');
  const ambiente=carregarAmbientePrivado();
  if(!ambiente.OPENROUTER_API_KEY)throw new Error('Chave servidor não configurada.');
  let controle=lerControle();
  if(!controle.chamadas.length)await enviarChamadaControlada('key',{headers:{Authorization:'Bearer '+ambiente.OPENROUTER_API_KEY}},'diagnostico-autenticacao');
  controle=lerControle();
  if(!controle.bloqueado&&typeof controle.modelo!=='object')await enviarChamadaControlada('models',{},'catalogo-modelo-precos');
  return lerControle();
}

export function encerrarRodada(){const controle=lerControle();controle.encerrada=true;controle.encerradaEm=new Date().toISOString();salvarControle(controle);}
