import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const programa = promisify(execFile);

test('Postgres isolado: agregação concorrente, privacidade, ledger, retenção e grants de operação', { skip: process.env.NUTRIFOTO_TESTAR_POSTGRES !== 'true', timeout: 90000 }, async () => {
  const nome = 'nutrifoto-operacao-' + randomUUID().slice(0, 8);
  async function sql(texto) {
    return new Promise((resolver, rejeitar) => {
      const filho = spawn('docker', ['exec', '-i', nome, 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']);
      let saida = '', erros = ''; filho.stdout.on('data', parte => { saida += parte; }); filho.stderr.on('data', parte => { erros += parte; });
      filho.on('error', rejeitar); filho.on('close', codigo => codigo ? rejeitar(Error(erros)) : resolver(saida.trim())); filho.stdin.end(texto);
    });
  }
  await programa('docker', ['run', '--rm', '-d', '--name', nome, '--network', 'none', '--memory', '256m', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_PASSWORD=ficticia-local', 'postgres:15-alpine']);
  try {
    let pronto=false;
    for (let tentativa = 0; tentativa < 60; tentativa++) {
      try { await programa('docker', ['exec', nome, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); pronto=true; break; } catch { await new Promise(resolver => setTimeout(resolver, 250)); }
    }
    assert(pronto,'Postgres precisa concluir a inicialização.');
    await sql(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for (const arquivo of ['001_comercial.sql', '002_storage.sql', '003_comercializacao.sql', '004_operacao.sql']) await sql(await readFile(new URL('../supabase/' + arquivo, import.meta.url), 'utf8'));
    await Promise.all(Array.from({ length: 24 }, () => sql("set role service_role; select public.nf_registrar_metrica('/api/dados',200,120);")));
    await sql("select public.nf_registrar_metrica('/api/webhook',503,60000);");
    const usuario = '11111111-1111-4111-8111-111111111111';
    await sql(`insert into auth.users values('${usuario}'); insert into public.nf_ia_custos(usuario,chave,hash,mes,reserva,estado) values('${usuario}','pendente','hash',date_trunc('month',now() at time zone 'UTC')::date,0.01,'reservado'),('${usuario}','incerto','hash',date_trunc('month',now() at time zone 'UTC')::date,0.02,'desconhecido');`);
    const resumo = JSON.parse(await sql('set role service_role; select public.nf_resumo_operacao(60);'));
    assert.equal(resumo.http.reduce((soma, linha) => soma + linha.quantidade, 0), 25);
    assert.equal(resumo.http.find(linha => linha.rota === '/api/dados').faixa_ms, 250);
    assert.equal(resumo.ia.custos_desconhecidos, 1); assert.equal(resumo.ia.reservas_pendentes, 1); assert.equal(resumo.ia.reserva_pendente_usd, .03);
    assert.deepEqual((await sql("select column_name from information_schema.columns where table_name='nf_metricas' order by ordinal_position")).split('\n'), ['minuto', 'rota', 'status', 'faixa_ms', 'quantidade', 'duracao_total_ms']);
    await assert.rejects(sql('set role anon; select * from public.nf_metricas;'), /permission denied/);
    await assert.rejects(sql('set role authenticated; select public.nf_resumo_operacao(60);'), /permission denied/);
    await assert.rejects(sql("select public.nf_registrar_metrica('/api/dados?privado',200,1);"), /check constraint/);
    await sql("insert into public.nf_metricas values(now()-interval '40 days','/api/dados',200,50,1,10);");
    assert.equal(await sql('set role service_role; select public.nf_limpar_metricas(30);'), '1');
    await assert.rejects(sql('select public.nf_limpar_metricas(0);'), /Reten/);
  } finally { await programa('docker', ['rm', '-f', nome]); }
});
