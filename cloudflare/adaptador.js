import { criarAplicacao } from '../servidor/aplicacao.js';
import { criarSaude, criarOperacao } from '../servidor/operacao.js';
import { criarManutencao } from '../servidor/manutencao.js';

// Adapta somente o transporte; persistência, autorização e limites continuam no backend existente.
export async function adaptarRequisicao(requisicao, atender) {
  const endereco=new URL(requisicao.url), cabecalhos=new Map();let corpo,encerrada=false;
  const entrada={url:endereco.pathname+endereco.search,method:requisicao.method,headers:Object.fromEntries(requisicao.headers),socket:{remoteAddress:requisicao.headers.get('cf-connecting-ip')||'indisponivel'},
    async *[Symbol.asyncIterator](){for await(const parte of requisicao.body||[])yield parte;}};
  const saida={statusCode:200,setHeader(nome,valor){cabecalhos.set(nome.toLowerCase(),valor);},getHeader(nome){return cabecalhos.get(nome.toLowerCase());},end(valor){corpo=valor;encerrada=true;}};
  await atender(entrada,saida);
  if(!encerrada)throw new Error('Handler não encerrou a resposta.');
  const headers=new Headers();for(const [nome,valor] of cabecalhos)for(const item of Array.isArray(valor)?valor:[valor])headers.append(nome,String(item));
  return new Response(requisicao.method==='HEAD'?null:corpo??null,{status:saida.statusCode,headers});
}

export function criarApiWorker(bindings) {
  const ambiente={...Object.fromEntries(Object.entries(bindings).filter(([,valor])=>typeof valor==='string')),CI_PRODUCAO:'true',NUTRIFOTO_SIMULADO:'false',LICENCAS_ANDROID:'true',ASAAS_AMBIENTE:'sandbox'};
  const aplicacao=criarAplicacao({ambiente});
  const especiais={'/api/saude':criarSaude(),'/api/operacao':criarOperacao({ambiente}),'/api/manutencao':criarManutencao({ambiente})};
  return requisicao=>adaptarRequisicao(requisicao,especiais[new URL(requisicao.url).pathname]||aplicacao);
}
