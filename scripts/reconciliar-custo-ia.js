import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { obterConfiguracao } from '../servidor/seguranca.js';
import { criarRepositorio } from '../servidor/repositorio.js';

// Não consulta o provedor nem gera IA. Use somente custo comprovado pelo extrato.
try {
  const [usuario, chave, custoInformado, referencia, confirmacao] = process.argv.slice(2);
  const custo = Number(custoInformado);
  if (!/^[a-f0-9-]{36}$/i.test(usuario || '') || !/^[a-zA-Z0-9_-]{1,100}$/.test(chave || '') || custoInformado === undefined || !Number.isFinite(custo) || custo < 0 || !/^[a-zA-Z0-9_:.-]{1,200}$/.test(referencia || '') || confirmacao !== '--confirmar-reconciliacao') throw new Error('Uso: node scripts/reconciliar-custo-ia.js UUID_USUARIO CHAVE_IDEMPOTENCIA CUSTO_USD REFERENCIA_EXTRATO --confirmar-reconciliacao');
  let ambiente = {};
  for (const nome of ['.env', '.env.local']) {
    try { ambiente = { ...ambiente, ...parseEnv(await readFile(nome, 'utf8')) }; } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
  const configuracao = obterConfiguracao({ ...ambiente, ...process.env });
  if (configuracao.simulado) throw new Error('Reconciliação exige banco de homologação ou produção explicitamente configurado.');
  await criarRepositorio(configuracao).executar('nf_confirmar_custo_ia', { p_usuario: usuario, p_chave: chave, p_custo: custo, p_referencia: referencia });
  console.info('Custo reconciliado no ledger. Nenhuma geração ou cobrança foi solicitada.');
} catch (erro) {
  console.error(erro.status ? 'Reconciliação indisponível ou recusada. Verifique banco e registro informado.' : erro.message);
  process.exitCode = 1;
}
