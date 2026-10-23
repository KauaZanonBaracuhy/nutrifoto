import { compararSegredo, obterConfiguracao } from './seguranca.js';
import { criarRepositorio } from './repositorio.js';
export function criarManutencao({ambiente=process.env,repositorio:adaptador}={}){
  return async function executarManutencao(requisicao,resposta){
    resposta.setHeader('Content-Type','application/json');resposta.setHeader('Cache-Control','no-store');
    try{
      if(!ambiente.CRON_SECRET||ambiente.CRON_SECRET.length<32){resposta.statusCode=503;resposta.end(JSON.stringify({erro:'Manutenção ainda não configurada.'}));return;}
      if(requisicao.method!=='GET'||!compararSegredo(requisicao.headers.authorization,'Bearer '+ambiente.CRON_SECRET)){resposta.statusCode=401;resposta.end(JSON.stringify({erro:'Acesso não autorizado.'}));return;}
      const repositorio=adaptador||criarRepositorio(obterConfiguracao(ambiente));
      const retencao = Number(ambiente.METRICAS_RETENCAO_DIAS ?? 30);
      if (ambiente.METRICAS_HABILITADAS === 'true' && (!Number.isInteger(retencao) || retencao < 1 || retencao > 365)) throw new Error('Retenção inválida.');
      const parametros = {
        p_resultados_dias: Number(ambiente.RETENCAO_RESULTADOS_DIAS ?? 7),
        p_eventos_dias: Number(ambiente.RETENCAO_EVENTOS_DIAS ?? 90),
        p_limites_dias: Number(ambiente.RETENCAO_LIMITES_DIAS ?? 1),
      };
      if (Object.values(parametros).some(valor => !Number.isInteger(valor) || valor < 1 || valor > 3650)) throw new Error('Retenção operacional inválida.');
      if (ambiente.NUTRIFOTO_SIMULADO === 'true') await repositorio.executar('nf_limpar_operacionais');
      else await repositorio.executar('nf_limpar_operacionais_comercial', parametros);
      if (ambiente.METRICAS_HABILITADAS === 'true') await repositorio.executar('nf_limpar_metricas', { p_dias: retencao });
      resposta.end(JSON.stringify({executado:true}));
    }catch{resposta.statusCode=503;resposta.end(JSON.stringify({erro:'Manutenção não concluída. Verifique o monitoramento.'}));}
  };
}
