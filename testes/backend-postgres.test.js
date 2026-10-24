import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const executarPrograma = promisify(execFile);
const habilitado = process.env.NUTRIFOTO_TESTAR_POSTGRES === 'true';

test('Postgres isolado: migração, grants/RLS, sessão, revisões, quotas concorrentes e eventos', { skip: !habilitado, timeout: 90000 }, async () => {
  const nome = `nutrifoto-teste-${randomUUID().slice(0, 8)}`;
  async function executarSql(sql) {
    return new Promise((resolver, rejeitar) => {
      const processo = spawn('docker', ['exec', '-i', nome, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres']);
      let saida = ''; let erros = '';
      processo.stdout.on('data', parte => { saida += parte; });
      processo.stderr.on('data', parte => { erros += parte; });
      processo.on('error', rejeitar);
      processo.on('close', codigo => codigo === 0 ? resolver(saida.trim()) : rejeitar(new Error(erros)));
      processo.stdin.end(sql);
    });
  }
  await executarPrograma('docker', ['run', '--rm', '-d', '--name', nome, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_PASSWORD=senha-ficticia-local', 'postgres:15-alpine']);
  try {
    let pronto = false;
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      try { await executarPrograma('docker', ['exec', nome, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); pronto = true; break; } catch { await new Promise(resolver => setTimeout(resolver, 250)); }
    }
    assert.ok(pronto, 'Postgres precisa iniciar');
    await executarSql(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    `);
    await executarSql(await readFile(new URL('../supabase/001_comercial.sql', import.meta.url), 'utf8'));
    await executarSql(await readFile(new URL('../supabase/002_storage.sql', import.meta.url), 'utf8'));
    assert.equal(await executarSql(`select public from storage.buckets where id='nutrifoto-imagens';`), 'f');
    const ana = '11111111-1111-4111-8111-111111111111';
    const bruno = '22222222-2222-4222-8222-222222222222';
    const sessao = '33333333-3333-4333-8333-333333333333';
    await executarSql(`insert into auth.users values('${ana}'),('${bruno}'); insert into auth.sessions values('${sessao}','${ana}');`);
    assert.equal(await executarSql(`select public.nf_sessao_ativa('${ana}','${sessao}');`), 't');
    assert.equal(await executarSql(`select public.nf_sessao_ativa('${bruno}','${sessao}');`), 'f');
    assert.equal(await executarSql(`select count(*) from pg_class where relname like 'nf_%' and relrowsecurity;`), '9');
    await executarSql(await readFile(new URL('../supabase/003_comercializacao.sql', import.meta.url), 'utf8'));
    // Migração aditiva pode ser reaplicada sem apagar dados ou permissões.
    await executarSql(await readFile(new URL('../supabase/003_comercializacao.sql', import.meta.url), 'utf8'));
    const orcamentos = await Promise.all(Array.from({ length: 8 }, (_, indice) => executarSql(`select public.nf_reservar_ia_comercial('${bruno}','comercial${indice}','hash',100,100,0.3,1,0.1);`).then(JSON.parse)));
    assert.equal(orcamentos.filter(item => item.repetido === false).length, 3);
    assert.equal(orcamentos.filter(item => item.codigo === 'ORCAMENTO_IA_EXCEDIDO').length, 5);
    const primeiraComercial = orcamentos.findIndex(item => item.repetido === false);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_ia_comercial('${bruno}','comercial${primeiraComercial}','hash',100,100,0.3,1,0.1);`)).status, 409);
    await executarSql(`select public.nf_finalizar_ia_comercial('${bruno}','comercial${primeiraComercial}','{"ok":true}',100,null);`);
    assert.equal(await executarSql(`select estado from public.nf_ia_custos where usuario='${bruno}' and chave='comercial${primeiraComercial}';`), 'desconhecido');
    assert.equal(await executarSql(`select comprometido=0.3 from public.nf_ia_orcamento;`), 't');
    await executarSql(`select public.nf_confirmar_custo_ia('${bruno}','comercial${primeiraComercial}',0.02,'provedor-homologacao-local');`);
    await executarSql(`select public.nf_confirmar_custo_ia('${bruno}','comercial${primeiraComercial}',0.02,'repetida');`);
    assert.equal(await executarSql(`select comprometido=0.22 from public.nf_ia_orcamento;`), 't');
    await assert.rejects(executarSql(`select public.nf_confirmar_custo_ia('${bruno}','comercial${primeiraComercial}',0.01);`), /custo ja conciliado/);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_ia_comercial('${bruno}','comercial${primeiraComercial}','hash',100,100,0.3,1,0.1);`)).repetido, true);
    await executarSql(`delete from public.nf_operacoes where usuario='${bruno}' and chave='comercial${primeiraComercial}';`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_ia_comercial('${bruno}','comercial${primeiraComercial}','hash',100,100,0.3,1,0.1);`)).status, 409);
    await assert.rejects(executarSql(`set role anon; select public.nf_confirmar_custo_ia('${bruno}','x',0);`), /permission denied/);
    await executarSql(`update public.nf_operacoes set criado=now()-interval '10 days' where usuario='${bruno}';`);
    await executarSql(`select public.nf_limpar_operacionais_comercial(30,90,1);`);
    assert.equal(await executarSql(`select count(*)>0 from public.nf_operacoes where usuario='${bruno}';`),'t');
    await executarSql(`select public.nf_limpar_operacionais_comercial(7,90,1);`);
    assert.equal(await executarSql(`select count(*) from public.nf_operacoes where usuario='${bruno}';`),'0');
    assert.equal(await executarSql(`select count(*) from public.nf_ia_custos where usuario='${bruno}';`),'3');
    assert.equal(await executarSql(`select comprometido=0.22 from public.nf_ia_orcamento;`),'t');
    await assert.rejects(executarSql(`select public.nf_limpar_operacionais_comercial(0,90,1);`), /retencao invalida/);
    await assert.rejects(executarSql(`set role anon; select public.nf_limpar_operacionais_comercial(7,90,1);`), /permission denied/);
    const intencoes = await Promise.all(Array.from({length:8},(_,indice)=>executarSql(`select public.nf_reservar_checkout('${ana}','tentativa${indice}','price_ficticio');`).then(JSON.parse)));
    assert.equal(new Set(intencoes.map(item=>item.chave)).size,1);
    assert.equal(new Set(intencoes.map(item=>item.expira)).size,1);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_checkout('${ana}','outra','price_outro');`)).status,409);
    await assert.rejects(executarSql(`set role anon; select public.nf_reservar_checkout('${ana}','outra','price_ficticio');`),/permission denied/);
    await assert.rejects(executarSql(`set role anon; select public.nf_ler_dados('${ana}');`), /permission denied/);
    await assert.rejects(executarSql(`set role authenticated; select * from public.nf_dados;`), /permission denied/);
    const dados = JSON.parse(await executarSql(`set role service_role; select public.nf_gravar_dados('${ana}','{"meals":[{"nome":"arroz"}]}',0,'primeira','hash1');`));
    assert.equal(dados.revisao, 1);
    const duplicada = JSON.parse(await executarSql(`select public.nf_gravar_dados('${ana}','{"meals":[{"nome":"arroz"}]}',0,'primeira','hash1');`));
    assert.equal(duplicada.revisao, 1);
    assert.equal(JSON.parse(await executarSql(`select public.nf_gravar_dados('${ana}','{}',1,'primeira','hash_diferente');`)).status, 409);
    const conflitos = await Promise.all(['segunda', 'terceira'].map(chave => executarSql(`select public.nf_gravar_dados('${ana}','{}',1,'${chave}','hash');`).then(JSON.parse)));
    assert.equal(conflitos.filter(resultado => resultado.revisao === 2).length, 1);
    assert.equal(conflitos.filter(resultado => resultado.status === 409).length, 1);
    assert.deepEqual(JSON.parse(await executarSql(`select public.nf_ler_dados('${bruno}');`)), { revisao: 0, dados: {} });
    const quotas = await Promise.all(Array.from({ length: 16 }, (_, indice) => executarSql(`select public.nf_reservar_ia('${ana}','ia${indice}','hash',5,50);`).then(JSON.parse)));
    assert.equal(quotas.filter(resultado => resultado.repetido === false).length, 5);
    assert.equal(quotas.filter(resultado => resultado.status === 429).length, 11);
    const consumida = JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`));
    assert.equal(consumida.consumo, 5);
    const chaveReservada = quotas.findIndex(resultado => resultado.repetido === false);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_ia('${ana}','ia${chaveReservada}','hash',5,50);`)).status, 409);
    await executarSql(`select public.nf_finalizar_ia('${ana}','ia${chaveReservada}','{"simulado":true}',100,0.001);`);
    assert.deepEqual(JSON.parse(await executarSql(`select public.nf_reservar_ia('${ana}','ia${chaveReservada}','hash',5,50);`)), { repetido: true, resultado: { simulado: true } });
    await executarSql(`select public.nf_cliente('${ana}','cus_ficticio'); select public.nf_registrar_assinatura('evt_novo',200,'cus_ficticio','sub_ficticio','active',extract(epoch from now()+interval '1 day')::bigint);`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`)).plano, 'pago');
    await executarSql(`select public.nf_registrar_bloqueio_pagamento('evt_reembolso',200,'cus_ficticio','reembolso:ch_1',true);`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`)).plano, 'gratuito');
    await executarSql(`select public.nf_registrar_bloqueio_pagamento('evt_reembolso_antigo',100,'cus_ficticio','reembolso:ch_1',false);`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`)).plano, 'gratuito');
    await executarSql(`select public.nf_registrar_bloqueio_pagamento('evt_reversao',201,'cus_ficticio','reembolso:ch_1',false);`);
    await executarSql(`select public.nf_registrar_assinatura('evt_antigo',100,'cus_ficticio','sub_ficticio','canceled',0);`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`)).plano, 'pago');
    assert.equal(JSON.parse(await executarSql(`select public.nf_registrar_assinatura('evt_novo',200,'cus_ficticio','sub_ficticio','canceled',0);`)).repetido, true);
    await executarSql(`select public.nf_registrar_assinatura('evt_expirado',300,'cus_ficticio','sub_ficticio','active',1);`);
    assert.equal(JSON.parse(await executarSql(`select public.nf_assinatura('${ana}',5,50);`)).plano, 'gratuito');
    const limites = await Promise.all(Array.from({ length: 8 }, () => executarSql(`select public.nf_limitar('rede_ficticia',3,60);`).then(JSON.parse)));
    assert.equal(limites.filter(resultado => resultado === true).length, 3);
    assert.equal(limites.filter(resultado => resultado.status === 429).length, 5);
    const reservasImagens = await Promise.all(Array.from({ length: 6 }, (_, indice) => executarSql(`select public.nf_reservar_imagem('${bruno}','${String(indice).padStart(64, '0')}.png',100,300);`).then(JSON.parse)));
    assert.equal(reservasImagens.filter(resultado => resultado.pronta === false).length, 3);
    assert.equal(reservasImagens.filter(resultado => resultado.status === 429).length, 3);
    const imagemReservada = reservasImagens.findIndex(resultado => resultado.pronta === false);
    const idImagem = `${String(imagemReservada).padStart(64, '0')}.png`;
    await executarSql(`select public.nf_finalizar_imagem('${bruno}','${idImagem}');`);
    assert.deepEqual(JSON.parse(await executarSql(`select public.nf_ler_imagem('${bruno}','${idImagem}');`)), { pronta: true });
    assert.equal(await executarSql(`select public.nf_ler_imagem('${ana}','${idImagem}');`), '');
    assert.deepEqual(JSON.parse(await executarSql('select public.nf_inventario_imagens_orfas();')), {quantidade:3,bytes:300,uploadsPendentes:2});
    await executarSql(`insert into public.nf_dados(usuario,dados) values('${bruno}',jsonb_build_object('meals',jsonb_build_array(jsonb_build_object('imagemRemota','${idImagem}'))));`);
    assert.deepEqual(JSON.parse(await executarSql('select public.nf_inventario_imagens_orfas();')), {quantidade:2,bytes:200,uploadsPendentes:2});
    await assert.rejects(executarSql('set role anon; select public.nf_inventario_imagens_orfas();'), /permission denied/);
    const exclusao = JSON.parse(await executarSql(`select public.nf_iniciar_exclusao('${bruno}');`));
    assert.equal(exclusao.status, 409);
    assert.equal(JSON.parse(await executarSql(`select public.nf_reservar_imagem('${bruno}','${'a'.repeat(64)}.png',100,1000);`)).status, 409);
    await executarSql(`delete from auth.users where id='${ana}';`);
    assert.equal(await executarSql(`select public.nf_sessao_ativa('${ana}','${sessao}');`), 'f');
    assert.equal(await executarSql(`select count(*) from public.nf_dados where usuario='${ana}';`), '0');
    assert.equal(await executarSql(`select count(*) from public.nf_operacoes where usuario='${ana}';`), '0');
    await executarSql('select public.nf_limpar_operacionais();');
  } finally {
    await executarPrograma('docker', ['rm', '-f', nome]);
  }
});
