import { falhar, lerRespostaLimitada } from './seguranca.js';

// Capacidades conferidas na documentação oficial em 28/10/2026; disponibilidade na conta é consultada por API.
const MODELOS = { 'qwen/qwen3.8-27b': { visao:true, schema:true } };
const ORIGEM = 'https://api.groq.com/openai/v1';
function limitar(segundos, mensagem) { throw Object.assign(new Error(mensagem),{status:429,retryAfter:segundos}); }
export function segundosEspera(valor, agora=Date.now()) {
  if (!valor) return 60;
  if (/^\d+(\.\d+)?$/.test(valor)) return Math.ceil(Number(valor));
  const data=Date.parse(valor);if(Number.isFinite(data))return Math.max(1,Math.ceil((data-agora)/1000));
  const unidades={h:3600,m:60,s:1,ms:0.001};let segundos=0;
  for(const m of valor.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g))segundos+=Number(m[1])*unidades[m[2]];
  return segundos>0?Math.ceil(segundos):60;
}

export function criarGroq(ambiente, { enviar=fetch, lerPausa=()=>0, gravarPausa=()=>{}, registrar=()=>{} }={}) {
  let verificadaAte=0, modelo;
  function conferirGratuidade() {
    if (!ambiente.GROQ_API_KEY) falhar(503,'GROQ_API_KEY não está configurada no servidor local.');
    const confirmacao=Date.parse(ambiente.GROQ_FREE_CONFIRMADO_EM||'');
    if(ambiente.GROQ_PLANO!=='free'||!Number.isFinite(confirmacao)||Date.now()-confirmacao<0||Date.now()-confirmacao>86400000)falhar(403,'Confirme o plano Free da organização Groq no painel e registre uma confirmação privada válida por 24 horas. Nenhuma chamada de geração foi realizada.');
    if(lerPausa()>Date.now()){const s=Math.ceil((lerPausa()-Date.now())/1000);limitar(s,'Cota Groq temporariamente indisponível. Aguarde '+s+' segundos antes de tentar novamente.');}
  }
  async function chamar(caminho, opcoes={}) {
    let resposta;
    try{resposta=await enviar(ORIGEM+caminho,{...opcoes,headers:{Authorization:'Bearer '+ambiente.GROQ_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000)});}catch{falhar(503,'Não foi possível conectar à Groq. Seus dados foram preservados.');}
    const limites={};
    for(const nome of ['retry-after','x-ratelimit-limit-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-requests','x-ratelimit-remaining-tokens','x-ratelimit-reset-requests','x-ratelimit-reset-tokens'])if(resposta.headers.has(nome))limites[nome]=resposta.headers.get(nome);
    if(resposta.status===429){try{const erro=JSON.parse(new TextDecoder().decode(await lerRespostaLimitada(resposta.clone(),10000))).error;limites['groq-codigo']=String(erro?.code||'');limites['groq-detalhe-limite']=String(erro?.message||'').match(/(?:tokens|requests) per (?:minute|day)|\b(?:TPM|TPD|RPM|RPD)\b|(?:Limit|Used|Requested|Please try again in)[: ]+[\d.,a-z ]+/gi)?.join('; ').slice(0,300)||'';}catch{}}
    registrar({status:resposta.status,modelo,limites});
    if(resposta.status===429){const segundos=Math.max(segundosEspera(limites['retry-after']||limites['x-ratelimit-reset-tokens']),segundosEspera(limites['x-ratelimit-reset-tokens']||limites['retry-after']),limites['x-ratelimit-remaining-requests']==='0'?segundosEspera(limites['x-ratelimit-reset-requests']):0);gravarPausa(Date.now()+segundos*1000);limitar(segundos,'Limite gratuito Groq atingido. Aguarde '+segundos+' segundos; não haverá repetição automática.');}
    if(resposta.status===401)falhar(401,'A chave Groq foi recusada. Confira a configuração privada no servidor.');
    if(resposta.status===403)falhar(403,'A organização Groq não autorizou este recurso ou modelo.');
    if(!resposta.ok)falhar(resposta.status===404?503:502,'A Groq não conseguiu concluir a operação. Confira o modelo e tente novamente mais tarde.');
    let dados;try{dados=JSON.parse(new TextDecoder().decode(await lerRespostaLimitada(resposta,1000000)));}catch{falhar(502,'Resposta Groq interrompida ou inválida. Nenhum resultado foi aplicado.');}
    if(limites['x-ratelimit-remaining-tokens']==='0'||limites['x-ratelimit-remaining-requests']==='0')gravarPausa(Date.now()+Math.max(limites['x-ratelimit-remaining-tokens']==='0'?segundosEspera(limites['x-ratelimit-reset-tokens']):0,limites['x-ratelimit-remaining-requests']==='0'?segundosEspera(limites['x-ratelimit-reset-requests']):0)*1000);
    return {ok:true,status:resposta.status,dados};
  }
  async function preparar() {
    conferirGratuidade();
    if(Date.now()<verificadaAte)return modelo;
    const solicitado=ambiente.GROQ_MODELO||'qwen/qwen3.8-27b';
    if(!MODELOS[solicitado])falhar(503,'Modelo Groq sem capacidades verificadas para os cinco módulos. Configure um modelo documentado antes de enviar dados.');
    const {dados}=await chamar('/models');
    if(!Array.isArray(dados.data)||!dados.data.some(m=>m.id===solicitado&&m.active!==false))falhar(503,'O modelo Groq configurado não está disponível nesta conta. Nenhuma geração foi enviada.');
    modelo=solicitado;verificadaAte=Date.now()+300000;return modelo;
  }
  async function transporte(url, opcoes) {
    await preparar();
    const corpo=JSON.parse(opcoes.body);
    const imagem=corpo.messages?.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='image_url'));
    if(imagem&&!MODELOS[modelo].visao)falhar(400,'O modelo Groq selecionado não aceita fotografias.');
    if(corpo.response_format?.type==='json_schema'&&!MODELOS[modelo].schema)falhar(400,'O modelo Groq selecionado não aceita este formato estruturado.');
    if(!Number.isInteger(corpo.max_tokens)||corpo.max_tokens<1||corpo.max_tokens>3500)falhar(400,'Limite de saída inválido.');
    corpo.model=modelo;corpo.max_completion_tokens=corpo.max_tokens;delete corpo.max_tokens;delete corpo.provider;delete corpo.usage;
    corpo.reasoning_effort='none';corpo.service_tier='on_demand';
    const resultado=await chamar('/chat/completions',{method:'POST',body:JSON.stringify(corpo)});
    if(!resultado.dados.choices?.[0]?.message?.content||resultado.dados.choices[0].finish_reason==='length')falhar(502,'A Groq devolveu uma resposta incompleta. Nenhum resultado foi aplicado.');
    registrar({status:200,modelo,uso:resultado.dados.usage||null});
    resultado.dados.usage={...resultado.dados.usage,cost:0};
    return resultado;
  }
  return {preparar,transporte,obterModelo:()=>modelo};
}
