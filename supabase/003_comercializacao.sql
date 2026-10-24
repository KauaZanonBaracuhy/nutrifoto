-- Ledger financeiro independente dos resultados efêmeros. Aplicar após 001/002.
begin;
create table if not exists public.nf_ia_orcamento (
 mes date primary key, comprometido numeric not null default 0 check(comprometido>=0)
);
create table if not exists public.nf_ia_custos (
 usuario uuid not null references auth.users(id) on delete cascade,
 chave text not null, hash text not null, mes date not null,
 reserva numeric not null check(reserva>0), custo numeric check(custo>=0),
 estado text not null default 'reservado' check(estado in ('reservado','desconhecido','confirmado')),
 criado timestamptz not null default now(), reconciliado timestamptz, referencia text,
 primary key(usuario,chave)
);
alter table public.nf_ia_orcamento enable row level security;
alter table public.nf_ia_custos enable row level security;
revoke all on public.nf_ia_orcamento,public.nf_ia_custos from public,anon,authenticated;

create or replace function public.nf_reservar_ia_comercial(p_usuario uuid,p_chave text,p_hash text,p_limite_gratis integer,p_limite_pago integer,p_limite_global numeric,p_limite_usuario numeric,p_reserva numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_mes date:=date_trunc('month',now() at time zone 'UTC')::date; v_custo public.nf_ia_custos; v_global numeric; v_usuario numeric; v_resultado jsonb;
begin
 -- Ordem única de locks: financeiro global, depois lock de conta de 001.
 perform pg_advisory_xact_lock(hashtextextended('nf_ia_financeiro',0));
 select * into v_custo from public.nf_ia_custos where usuario=p_usuario and chave=p_chave;
 if found then
   if v_custo.hash<>p_hash then return jsonb_build_object('erro','Chave reutilizada para outra operação.','status',409); end if;
   select resultado into v_resultado from public.nf_operacoes where usuario=p_usuario and tipo='ia' and chave=p_chave;
   if v_resultado is not null then return jsonb_build_object('repetido',true,'resultado',v_resultado); end if;
   return jsonb_build_object('erro','Operação já recebida. Aguarde reconciliação; não repita a análise.','status',409,'codigo','IA_RECONCILIACAO_NECESSARIA');
 end if;
 if p_reserva<=0 or p_limite_global<p_reserva or p_limite_usuario<p_reserva then raise exception 'orcamento invalido'; end if;
 insert into public.nf_ia_orcamento(mes) values(v_mes) on conflict do nothing;
 select comprometido into v_global from public.nf_ia_orcamento where mes=v_mes for update;
 select coalesce(sum(coalesce(custo,reserva)),0) into v_usuario from public.nf_ia_custos where usuario=p_usuario and mes=v_mes;
 if v_global+p_reserva>p_limite_global or v_usuario+p_reserva>p_limite_usuario then return jsonb_build_object('erro','Orçamento mensal de IA atingido.','status',429,'codigo','ORCAMENTO_IA_EXCEDIDO'); end if;
 v_resultado:=public.nf_reservar_ia(p_usuario,p_chave,p_hash,p_limite_gratis,p_limite_pago);
 if v_resultado ? 'erro' or coalesce((v_resultado->>'repetido')::boolean,false) then return v_resultado; end if;
 insert into public.nf_ia_custos(usuario,chave,hash,mes,reserva) values(p_usuario,p_chave,p_hash,v_mes,p_reserva);
 update public.nf_ia_orcamento set comprometido=comprometido+p_reserva where mes=v_mes;
 return v_resultado;
end $$;

create or replace function public.nf_confirmar_custo_ia(p_usuario uuid,p_chave text,p_custo numeric,p_referencia text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_custo public.nf_ia_custos;
begin
 perform pg_advisory_xact_lock(hashtextextended('nf_ia_financeiro',0));
 select * into v_custo from public.nf_ia_custos where usuario=p_usuario and chave=p_chave for update;
 if not found then raise exception 'reserva ausente'; end if;
 if p_custo is null then update public.nf_ia_custos set estado='desconhecido' where usuario=p_usuario and chave=p_chave and custo is null; return true; end if;
 if p_custo<0 then raise exception 'custo invalido'; end if;
 if v_custo.custo is not null then
   if v_custo.custo<>p_custo then raise exception 'custo ja conciliado'; end if;
   return true;
 end if;
 update public.nf_ia_orcamento set comprometido=comprometido-v_custo.reserva+p_custo where mes=v_custo.mes;
 update public.nf_ia_custos set custo=p_custo,estado='confirmado',reconciliado=now(),referencia=left(p_referencia,200) where usuario=p_usuario and chave=p_chave;
 return true;
end $$;

create or replace function public.nf_finalizar_ia_comercial(p_usuario uuid,p_chave text,p_resultado jsonb,p_tokens bigint,p_custo numeric)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform public.nf_confirmar_custo_ia(p_usuario,p_chave,p_custo);
 perform public.nf_finalizar_ia(p_usuario,p_chave,p_resultado,p_tokens,p_custo);
 return true;
end $$;

create table if not exists public.nf_bloqueios_pagamento (
 usuario uuid not null references auth.users(id) on delete cascade,
 referencia text not null, bloqueado boolean not null, evento_criado bigint not null,
 atualizado timestamptz not null default now(), primary key(usuario,referencia)
);
alter table public.nf_bloqueios_pagamento enable row level security;
revoke all on public.nf_bloqueios_pagamento from public,anon,authenticated;

create or replace function public.nf_registrar_bloqueio_pagamento(p_evento text,p_criado bigint,p_cliente text,p_referencia text,p_bloqueado boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_usuario uuid;
begin
 select usuario into v_usuario from public.nf_clientes where cliente=p_cliente for update;
 if not found then raise exception 'cliente ainda nao vinculado'; end if;
 insert into public.nf_eventos(evento) values(p_evento) on conflict do nothing;
 if not found then return '{"recebido":true,"repetido":true}'::jsonb; end if;
 insert into public.nf_bloqueios_pagamento(usuario,referencia,bloqueado,evento_criado) values(v_usuario,p_referencia,p_bloqueado,p_criado)
 on conflict(usuario,referencia) do update set bloqueado=excluded.bloqueado,evento_criado=excluded.evento_criado,atualizado=now()
 where public.nf_bloqueios_pagamento.evento_criado<=excluded.evento_criado;
 return '{"recebido":true}'::jsonb;
end $$;

create or replace function public.nf_assinatura(p_usuario uuid,p_limite_gratis integer,p_limite_pago integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente public.nf_clientes; v_pago boolean; v_chamadas integer; v_bloqueado boolean;
begin
 select * into v_cliente from public.nf_clientes where usuario=p_usuario;
 select exists(select 1 from public.nf_bloqueios_pagamento where usuario=p_usuario and bloqueado) into v_bloqueado;
 v_pago:=coalesce(v_cliente.status in ('active','trialing') and v_cliente.expira>now(),false) and not v_bloqueado;
 select chamadas into v_chamadas from public.nf_consumo where usuario=p_usuario and mes=date_trunc('month',now() at time zone 'UTC')::date;
 return jsonb_build_object('plano',case when v_pago then 'pago' else 'gratuito' end,'status',case when v_bloqueado then 'revisao_pagamento' else coalesce(v_cliente.status,'gratuito') end,'expira',v_cliente.expira,'limite',case when v_pago then p_limite_pago else p_limite_gratis end,'consumo',coalesce(v_chamadas,0),'sandbox',true);
end $$;

create or replace function public.nf_reservar_imagem_comercial(p_usuario uuid,p_imagem text,p_tamanho bigint,p_limite bigint,p_quantidade integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,0));
 if not exists(select 1 from public.nf_imagens where usuario=p_usuario and id=p_imagem) and (select count(*) from public.nf_imagens where usuario=p_usuario)>=p_quantidade then return jsonb_build_object('erro','Quantidade de fotos do plano atingida.','status',429); end if;
 return public.nf_reservar_imagem(p_usuario,p_imagem,p_tamanho,p_limite);
end $$;

-- Limpa conteúdo efêmero, preservando tombstones financeiros de contas ativas.
create or replace function public.nf_limpar_operacionais_comercial(p_resultados_dias integer default 7,p_eventos_dias integer default 90,p_limites_dias integer default 1)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_resultados_dias is null or p_eventos_dias is null or p_limites_dias is null or p_resultados_dias not between 1 and 3650 or p_eventos_dias not between 1 and 3650 or p_limites_dias not between 1 and 3650 then raise exception 'retencao invalida'; end if;
 delete from public.nf_limites where atualizado<now()-make_interval(days=>p_limites_dias);
 delete from public.nf_operacoes where criado<now()-make_interval(days=>p_resultados_dias);
 delete from public.nf_eventos where criado<now()-make_interval(days=>p_eventos_dias);
end $$;

-- Inventário administrativo sem identificadores/conteúdo. Não apaga objetos.
create or replace function public.nf_inventario_imagens_orfas()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('quantidade',count(*),'bytes',coalesce(sum(i.tamanho),0),'uploadsPendentes',count(*) filter(where not i.pronta))
 from public.nf_imagens i
 where not exists(select 1 from public.nf_dados d cross join lateral jsonb_array_elements(coalesce(d.dados->'meals','[]'::jsonb)) m where d.usuario=i.usuario and m->>'imagemRemota'=i.id);
$$;

do $$ declare v_funcao regprocedure; begin
 for v_funcao in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('nf_reservar_ia_comercial','nf_confirmar_custo_ia','nf_finalizar_ia_comercial','nf_registrar_bloqueio_pagamento','nf_assinatura','nf_reservar_imagem_comercial','nf_limpar_operacionais_comercial','nf_inventario_imagens_orfas') loop
 execute format('revoke all on function %s from public,anon,authenticated',v_funcao);
 execute format('grant execute on function %s to service_role',v_funcao);
 end loop;
end $$;
commit;
