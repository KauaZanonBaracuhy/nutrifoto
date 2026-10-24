-- Aplicar pelo proprietário em um projeto Supabase de homologação antes do deploy.
-- Todo acesso do navegador passa pelo BFF; tabelas e RPC não são públicos.
begin;

create table if not exists public.nf_dados (
  usuario uuid primary key references auth.users(id) on delete cascade,
  revisao bigint not null default 0 check (revisao >= 0),
  dados jsonb not null default '{}'::jsonb check (octet_length(dados::text) <= 4000000),
  atualizado timestamptz not null default now()
);
create table if not exists public.nf_clientes (
  usuario uuid primary key references auth.users(id) on delete cascade,
  cliente text unique not null,
  assinatura text,
  status text not null default 'gratuito',
  expira timestamptz,
  evento_criado bigint not null default 0
);
create table if not exists public.nf_consumo (
  usuario uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  chamadas integer not null default 0 check (chamadas >= 0),
  tokens bigint not null default 0,
  custo_usd numeric,
  primary key (usuario,mes)
);
create table if not exists public.nf_operacoes (
  usuario uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  chave text not null,
  hash text not null,
  resultado jsonb,
  criado timestamptz not null default now(),
  primary key(usuario,tipo,chave)
);
create table if not exists public.nf_limites (
  chave text not null,
  janela bigint not null,
  chamadas integer not null,
  atualizado timestamptz not null default now(),
  primary key(chave,janela)
);
create table if not exists public.nf_eventos (
  evento text primary key,
  criado timestamptz not null default now()
);
create table if not exists public.nf_imagens (
  usuario uuid not null references auth.users(id) on delete cascade,
  id text not null check(id ~ '^[a-f0-9]{64}\.(jpg|png|webp)$'),
  tamanho bigint not null check(tamanho>0 and tamanho<=1000000),
  pronta boolean not null default false,
  criado timestamptz not null default now(),
  primary key(usuario,id)
);
create table if not exists public.nf_exclusoes (
 usuario uuid primary key references auth.users(id) on delete cascade,
 criado timestamptz not null default now()
);
create table if not exists public.nf_checkout (
 usuario uuid primary key references auth.users(id) on delete cascade,
 chave text not null,
 preco text not null,
 expira bigint not null
);
alter table public.nf_checkout enable row level security;
revoke all on public.nf_checkout from public,anon,authenticated;

create or replace function public.nf_reservar_checkout(p_usuario uuid,p_chave text,p_preco text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_intencao public.nf_checkout;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 select * into v_intencao from public.nf_checkout where usuario=p_usuario;
 if found and v_intencao.expira>extract(epoch from now()) then
   if v_intencao.preco<>p_preco then return jsonb_build_object('erro','Plano alterado. Aguarde expirar a tentativa anterior de pagamento.','status',409); end if;
 else
   insert into public.nf_checkout(usuario,chave,preco,expira)
   values(p_usuario,p_chave,p_preco,floor(extract(epoch from now()+interval '24 hours'))::bigint)
   on conflict(usuario) do update set chave=excluded.chave,preco=excluded.preco,expira=excluded.expira
   returning * into v_intencao;
 end if;
 return jsonb_build_object('chave',v_intencao.chave,'expira',v_intencao.expira);
end;
$$;

alter table public.nf_dados enable row level security;
alter table public.nf_clientes enable row level security;
alter table public.nf_consumo enable row level security;
alter table public.nf_operacoes enable row level security;
alter table public.nf_limites enable row level security;
alter table public.nf_eventos enable row level security;
alter table public.nf_imagens enable row level security;
alter table public.nf_exclusoes enable row level security;
-- Defesa adicional: sem privilégios de tabela ou RPC para anon/authenticated.
revoke all on public.nf_dados,public.nf_clientes,public.nf_consumo,public.nf_operacoes,public.nf_limites,public.nf_eventos from anon,authenticated;
revoke all on public.nf_imagens,public.nf_exclusoes from anon,authenticated;
create policy nf_dados_proprietario on public.nf_dados for all to authenticated using ((select auth.uid()) = usuario) with check ((select auth.uid()) = usuario);
create policy nf_consumo_proprietario on public.nf_consumo for select to authenticated using ((select auth.uid()) = usuario);

create or replace function public.nf_sessao_ativa(p_usuario uuid,p_sessao uuid,p_permitir_exclusao boolean default false)
returns boolean language sql security definer set search_path = '' as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=p_usuario and s.id=p_sessao)
 and (p_permitir_exclusao or not exists(select 1 from public.nf_exclusoes where usuario=p_usuario));
$$;

-- JSON permite retornar falha sem rollback do contador (tentativas rejeitadas também contam).
create or replace function public.nf_limitar(p_chave text,p_limite integer,p_janela integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_janela bigint; v_total integer;
begin
 if p_limite < 1 or p_limite > 10000 or p_janela < 1 or p_janela > 86400 then raise exception 'limite invalido'; end if;
 v_janela := floor(extract(epoch from now()) / p_janela);
 insert into public.nf_limites(chave,janela,chamadas) values(p_chave,v_janela,1)
 on conflict(chave,janela) do update set chamadas=public.nf_limites.chamadas+1,atualizado=now() returning chamadas into v_total;
 if v_total > p_limite then return jsonb_build_object('erro','Muitas tentativas. Aguarde e tente novamente.','status',429); end if;
 return 'true'::jsonb;
end;
$$;

create or replace function public.nf_ler_dados(p_usuario uuid)
returns jsonb language sql security definer set search_path = '' as $$
 select coalesce((select jsonb_build_object('revisao',revisao,'dados',dados) from public.nf_dados where usuario=p_usuario),'{"revisao":0,"dados":{}}'::jsonb);
$$;

create or replace function public.nf_gravar_dados(p_usuario uuid,p_dados jsonb,p_revisao bigint,p_chave text,p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_anterior public.nf_dados; v_operacao public.nf_operacoes; v_resultado jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 select * into v_operacao from public.nf_operacoes where usuario=p_usuario and tipo='dados' and chave=p_chave;
 if found then
   if v_operacao.hash <> p_hash then return jsonb_build_object('erro','Chave reutilizada para outra operação.','status',409); end if;
   return v_operacao.resultado;
 end if;
 insert into public.nf_dados(usuario) values(p_usuario) on conflict do nothing;
 select * into v_anterior from public.nf_dados where usuario=p_usuario for update;
 if v_anterior.revisao <> p_revisao then return jsonb_build_object('erro','Dados alterados em outro dispositivo. Recarregue antes de salvar.','status',409,'codigo','CONFLITO_REVISAO'); end if;
 if jsonb_typeof(p_dados) <> 'object' or octet_length(p_dados::text)>4000000 then return jsonb_build_object('erro','Pacote de dados inválido.','status',413); end if;
 if exists(select 1 from jsonb_array_elements(p_dados->'meals') as m where m->>'imagemRemota' is not null and not exists(select 1 from public.nf_imagens i where i.usuario=p_usuario and i.id=m->>'imagemRemota' and i.pronta)) then return jsonb_build_object('erro','Imagem não encontrada nesta conta.','status',400); end if;
 update public.nf_dados set dados=p_dados,revisao=revisao+1,atualizado=now() where usuario=p_usuario;
 v_resultado := jsonb_build_object('revisao',v_anterior.revisao+1,'dados',p_dados);
 insert into public.nf_operacoes(usuario,tipo,chave,hash,resultado) values(p_usuario,'dados',p_chave,p_hash,v_resultado);
 return v_resultado;
end;
$$;

create or replace function public.nf_assinatura(p_usuario uuid,p_limite_gratis integer,p_limite_pago integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cliente public.nf_clientes; v_pago boolean; v_chamadas integer;
begin
 select * into v_cliente from public.nf_clientes where usuario=p_usuario;
 v_pago := coalesce(v_cliente.status in ('active','trialing') and v_cliente.expira > now(),false);
 select chamadas into v_chamadas from public.nf_consumo where usuario=p_usuario and mes=date_trunc('month',now() at time zone 'UTC')::date;
 return jsonb_build_object('plano',case when v_pago then 'pago' else 'gratuito' end,'status',coalesce(v_cliente.status,'gratuito'),'expira',v_cliente.expira,'limite',case when v_pago then p_limite_pago else p_limite_gratis end,'consumo',coalesce(v_chamadas,0),'sandbox',true);
end;
$$;

create or replace function public.nf_reservar_ia(p_usuario uuid,p_chave text,p_hash text,p_limite_gratis integer,p_limite_pago integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operacao public.nf_operacoes; v_assinatura jsonb; v_consumo integer; v_mes date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 select * into v_operacao from public.nf_operacoes where usuario=p_usuario and tipo='ia' and chave=p_chave;
 if found then
   if v_operacao.hash<>p_hash then return jsonb_build_object('erro','Chave reutilizada para outra operação.','status',409); end if;
   if v_operacao.resultado is null then return jsonb_build_object('erro','Operação já recebida. Aguarde ou inicie outra análise.','status',409); end if;
   return jsonb_build_object('repetido',true,'resultado',v_operacao.resultado);
 end if;
 v_assinatura := public.nf_assinatura(p_usuario,p_limite_gratis,p_limite_pago);
 v_mes := date_trunc('month',now() at time zone 'UTC')::date;
 insert into public.nf_consumo(usuario,mes) values(p_usuario,v_mes) on conflict do nothing;
 select chamadas into v_consumo from public.nf_consumo where usuario=p_usuario and mes=v_mes for update;
 if v_consumo >= (v_assinatura->>'limite')::integer then return jsonb_build_object('erro','Quota de IA atingida.','status',429,'codigo','QUOTA_EXCEDIDA'); end if;
 update public.nf_consumo set chamadas=chamadas+1 where usuario=p_usuario and mes=v_mes;
 insert into public.nf_operacoes(usuario,tipo,chave,hash) values(p_usuario,'ia',p_chave,p_hash);
 return '{"repetido":false}'::jsonb;
end;
$$;

create or replace function public.nf_finalizar_ia(p_usuario uuid,p_chave text,p_resultado jsonb,p_tokens bigint,p_custo numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_criado timestamptz;
begin
 update public.nf_operacoes set resultado=p_resultado where usuario=p_usuario and tipo='ia' and chave=p_chave and resultado is null returning criado into v_criado;
 if found then
   update public.nf_consumo set tokens=tokens+greatest(0,p_tokens),custo_usd=coalesce(custo_usd,0)+greatest(0,coalesce(p_custo,0)) where usuario=p_usuario and mes=date_trunc('month',v_criado at time zone 'UTC')::date;
 end if;
 return true;
end;
$$;

create or replace function public.nf_cliente(p_usuario uuid,p_cliente text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_cliente text;
begin
 if p_cliente is not null then insert into public.nf_clientes(usuario,cliente) values(p_usuario,p_cliente) on conflict(usuario) do nothing; end if;
 select cliente into v_cliente from public.nf_clientes where usuario=p_usuario;
 return v_cliente;
end;
$$;

create or replace function public.nf_registrar_assinatura(p_evento text,p_criado bigint,p_cliente text,p_assinatura text,p_status text,p_expira bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.nf_clientes where cliente=p_cliente) then raise exception 'cliente ainda nao vinculado'; end if;
 insert into public.nf_eventos(evento) values(p_evento) on conflict do nothing;
 if not found then return '{"recebido":true,"repetido":true}'::jsonb; end if;
 update public.nf_clientes set assinatura=p_assinatura,status=p_status,expira=to_timestamp(p_expira),evento_criado=p_criado where cliente=p_cliente and evento_criado<=p_criado;
 return '{"recebido":true}'::jsonb;
end;
$$;

-- Executar via agendamento administrativo diário; não contém conteúdo alimentar.
create or replace function public.nf_limpar_operacionais()
returns void language sql security definer set search_path = '' as $$
 delete from public.nf_limites where atualizado < now()-interval '1 day';
 delete from public.nf_operacoes where criado < now()-interval '7 days';
 delete from public.nf_eventos where criado < now()-interval '90 days';
$$;

create or replace function public.nf_reservar_imagem(p_usuario uuid,p_imagem text,p_tamanho bigint,p_limite bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_imagem public.nf_imagens; v_total bigint; v_quantidade integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 if exists(select 1 from public.nf_exclusoes where usuario=p_usuario) then return jsonb_build_object('erro','Conta em exclusão.','status',409); end if;
 select * into v_imagem from public.nf_imagens where usuario=p_usuario and id=p_imagem;
 if found then return jsonb_build_object('pronta',v_imagem.pronta); end if;
 select coalesce(sum(tamanho),0),count(*) into v_total,v_quantidade from public.nf_imagens where usuario=p_usuario;
 if v_total+p_tamanho>p_limite or v_quantidade>=10000 then return jsonb_build_object('erro','Quota de armazenamento de imagens atingida.','status',429); end if;
 insert into public.nf_imagens(usuario,id,tamanho) values(p_usuario,p_imagem,p_tamanho);
 return '{"pronta":false}'::jsonb;
end;
$$;

create or replace function public.nf_finalizar_imagem(p_usuario uuid,p_imagem text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 update public.nf_imagens set pronta=true where usuario=p_usuario and id=p_imagem;
 return found;
end;
$$;

create or replace function public.nf_ler_imagem(p_usuario uuid,p_imagem text)
returns jsonb language sql security definer set search_path = '' as $$
 select (select jsonb_build_object('pronta',pronta) from public.nf_imagens where usuario=p_usuario and id=p_imagem);
$$;
create or replace function public.nf_listar_imagens(p_usuario uuid)
returns jsonb language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id)),'[]'::jsonb) from (select id from public.nf_imagens where usuario=p_usuario order by id limit 100) as lote;
$$;
create or replace function public.nf_remover_imagens(p_usuario uuid,p_imagens text[])
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 delete from public.nf_imagens where usuario=p_usuario and id=any(p_imagens);
 return true;
end;
$$;
create or replace function public.nf_iniciar_exclusao(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 insert into public.nf_exclusoes(usuario) values(p_usuario) on conflict do nothing;
 -- Aguarde terminar qualquer upload autorizado antes do bloqueio da conta.
 if exists(select 1 from public.nf_imagens where usuario=p_usuario and not pronta and criado>now()-interval '2 minutes') then return jsonb_build_object('erro','Exclusão iniciada. Aguarde dois minutos para encerrar uploads em andamento e confirme novamente.','status',409,'codigo','EXCLUSAO_EM_ANDAMENTO'); end if;
 return 'true'::jsonb;
end;
$$;

do $$
declare v_funcao regprocedure;
begin
 for v_funcao in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'nf\_%' escape '\' loop
   execute format('revoke all on function %s from public, anon, authenticated',v_funcao);
   execute format('grant execute on function %s to service_role',v_funcao);
 end loop;
end $$;
commit;
