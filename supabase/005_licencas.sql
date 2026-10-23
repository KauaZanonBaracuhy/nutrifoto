-- Licenças independentes de Auth: nenhuma conta ou dado antigo é removido.
begin;
create table public.nf_licencas (
  id uuid primary key default gen_random_uuid(), chave text unique not null,
  publica text not null, recuperacao text, revisao bigint not null default 0,
  estado jsonb not null default '{"compras":{}}', criado timestamptz not null default now()
);
create table public.nf_licenca_desafios (nonce text primary key, vence timestamptz not null);
create table public.nf_licenca_compras (referencia uuid primary key, licenca uuid not null references public.nf_licencas(id));
create table public.nf_licenca_operacoes (
  licenca uuid references public.nf_licencas(id), chave uuid, hash text not null,
  tipo text not null, dia date not null, mes date not null, reserva numeric not null,
  resultado jsonb, custo numeric, primary key(licenca,chave)
);
create table public.nf_licenca_orcamentos (mes date, escopo text, valor numeric not null default 0, primary key(mes,escopo));
create index nf_licenca_operacoes_dia on public.nf_licenca_operacoes(licenca,dia,tipo);
create unique index nf_licenca_recuperacao on public.nf_licencas(recuperacao) where recuperacao is not null;
create index nf_licenca_desafios_vence on public.nf_licenca_desafios(vence);
alter table public.nf_licencas enable row level security;
alter table public.nf_licenca_desafios enable row level security;
alter table public.nf_licenca_compras enable row level security;
alter table public.nf_licenca_operacoes enable row level security;
alter table public.nf_licenca_orcamentos enable row level security;
revoke all on public.nf_licencas,public.nf_licenca_desafios,public.nf_licenca_operacoes,public.nf_licenca_orcamentos from anon,authenticated;
revoke all on public.nf_licenca_compras from anon,authenticated;

create function public.nf_licenca_ler(p_chave text) returns jsonb language sql security definer set search_path=public as $$
 select to_jsonb(l) from nf_licencas l where chave=p_chave;
$$;
create function public.nf_licenca_ler_id(p_id uuid) returns jsonb language sql security definer set search_path=public as $$ select to_jsonb(l) from nf_licencas l where id=p_id; $$;
create function public.nf_licenca_cobranca(p_referencia text) returns jsonb language sql security definer set search_path=public as $$ select to_jsonb(l) from nf_licencas l join nf_licenca_compras c on c.licenca=l.id where c.referencia::text=p_referencia; $$;
create function public.nf_licenca_inscrever(p_chave text,p_publica text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 insert into nf_licencas(chave,publica) values(p_chave,p_publica) on conflict(chave) do nothing;
 return nf_licenca_ler(p_chave);
end; $$;
create function public.nf_licenca_desafio(p_nonce text,p_consumir boolean default false) returns boolean language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 if p_consumir then
   delete from nf_licenca_desafios where nonce=p_nonce and vence>now(); get diagnostics total=row_count; return total=1;
 end if;
 delete from nf_licenca_desafios where vence<now();
 insert into nf_licenca_desafios values(p_nonce,now()+interval '90 seconds'); return true;
end; $$;
create function public.nf_licenca_cas(p_id uuid,p_revisao bigint,p_estado jsonb,p_recuperacao text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare registro nf_licencas; referencia_compra text; dono uuid;
begin
 perform 1 from nf_licencas where id=p_id and revisao=p_revisao for update;
 if not found then return null; end if;
 for referencia_compra in select jsonb_object_keys(p_estado->'compras') loop
   insert into nf_licenca_compras values(referencia_compra::uuid,p_id) on conflict do nothing;
   select licenca into dono from nf_licenca_compras where nf_licenca_compras.referencia=referencia_compra::uuid;
   if dono<>p_id then raise exception 'Intencao pertence a outra licenca'; end if;
 end loop;
 update nf_licencas set estado=p_estado,revisao=revisao+1,recuperacao=coalesce(p_recuperacao,recuperacao)
 where id=p_id and revisao=p_revisao returning * into registro;
 if not found then return null; end if; return to_jsonb(registro);
end; $$;
create function public.nf_licenca_transferir(p_atual uuid,p_codigo text,p_chave text,p_publica text) returns jsonb language plpgsql security definer set search_path=public as $$
declare origem nf_licencas; destino nf_licencas;
begin
 perform pg_advisory_xact_lock(7419001);
 select * into origem from nf_licencas where recuperacao=p_codigo for update;
 if not found or origem.id=p_atual then return jsonb_build_object('erro','Código de recuperação inválido.','status',403); end if;
 select * into destino from nf_licencas where id=p_atual and chave=p_chave for update;
 if not found or destino.estado->'compras'<>'{}'::jsonb then return jsonb_build_object('erro','Este dispositivo já possui compras. Procure o suporte.','status',409); end if;
 delete from nf_licencas where id=p_atual;
 update nf_licencas set chave=p_chave,publica=p_publica,recuperacao=null,revisao=revisao+1 where id=origem.id returning * into origem;
 return to_jsonb(origem);
end; $$;
create function public.nf_licenca_uso(p_id uuid) returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('fotos',count(*) filter(where tipo='foto'),'textos',count(*) filter(where tipo='texto'))
 from nf_licenca_operacoes where licenca=p_id and dia=(now() at time zone 'America/Sao_Paulo')::date;
$$;
create function public.nf_licenca_reservar(p_id uuid,p_dispositivo text,p_chave uuid,p_hash text,p_tipo text,p_limite integer,p_global numeric,p_individual numeric,p_reserva numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare lic nf_licencas; op nf_licenca_operacoes; mes_atual date:=date_trunc('month',now() at time zone 'UTC')::date; dia_atual date:=(now() at time zone 'America/Sao_Paulo')::date; total integer; teto integer;
begin
 perform pg_advisory_xact_lock(7419002);
 select * into lic from nf_licencas where id=p_id for update;
 if not found or lic.chave<>p_dispositivo or coalesce((lic.estado->>'bloqueada')::boolean,false) or coalesce((lic.estado->>'validade')::timestamptz,now())<=now() then return jsonb_build_object('erro','Licença vencida, bloqueada ou transferida.','status',403); end if;
 if p_tipo not in ('foto','texto') then return jsonb_build_object('erro','Planos clínicos não disponíveis.','status',403); end if;
 select * into op from nf_licenca_operacoes where licenca=p_id and chave=p_chave;
 if found then
   if op.hash<>p_hash then return jsonb_build_object('erro','Chave já usada para outra análise.','status',409); end if;
   if op.resultado is null then return jsonb_build_object('erro','Análise em processamento ou aguardando reconciliação.','status',409); end if;
   return jsonb_build_object('repetido',true,'resultado',op.resultado);
 end if;
 teto:=case when p_tipo='foto' then case when lic.estado->>'plano'='completo' then 100 else 50 end else case when lic.estado->>'plano'='completo' then 200 else 100 end end;
 select count(*) into total from nf_licenca_operacoes where licenca=p_id and dia=dia_atual and tipo=p_tipo;
 if total>=least(p_limite,teto) then return jsonb_build_object('erro','Franquia diária atingida. Ela será renovada à meia-noite de Brasília.','status',429); end if;
 -- Tetos independentes da configuração comercial: US$100 global e US$5/licença/mês.
 if p_reserva<=0 or p_reserva>0.05 or p_global<=0 or p_individual<=0 then return jsonb_build_object('erro','Orçamento de IA indisponível.','status',503); end if;
 insert into nf_licenca_orcamentos values(mes_atual,'global',0),(mes_atual,p_id::text,0) on conflict do nothing;
 if exists(select 1 from nf_licenca_orcamentos where mes=mes_atual and ((escopo='global' and valor+p_reserva>least(p_global,100)) or (escopo=p_id::text and valor+p_reserva>least(p_individual,5)))) then return jsonb_build_object('erro','Orçamento operacional de IA atingido.','status',429); end if;
 update nf_licenca_orcamentos set valor=valor+p_reserva where mes=mes_atual and escopo in('global',p_id::text);
 insert into nf_licenca_operacoes values(p_id,p_chave,p_hash,p_tipo,dia_atual,mes_atual,p_reserva,null,null);
 return jsonb_build_object('repetido',false);
end; $$;
create function public.nf_licenca_finalizar(p_id uuid,p_chave uuid,p_resultado jsonb,p_custo numeric) returns boolean language plpgsql security definer set search_path=public as $$
declare op nf_licenca_operacoes;
begin
 perform pg_advisory_xact_lock(7419002);
 select * into op from nf_licenca_operacoes where licenca=p_id and chave=p_chave for update;
 if not found or op.resultado is not null then return false; end if;
 if p_custo is not null and p_custo>=0 and p_custo<=op.reserva then
   update nf_licenca_orcamentos set valor=valor-op.reserva+p_custo where mes=op.mes and escopo in('global',p_id::text);
 end if;
 if p_custo>op.reserva then update nf_licenca_orcamentos set valor=greatest(valor,100) where mes=op.mes and escopo='global'; end if;
 update nf_licenca_operacoes set resultado=p_resultado,custo=p_custo where licenca=p_id and chave=p_chave;
 return true;
end; $$;
do $$ declare f record; begin
 for f in select oid::regprocedure as nome from pg_proc where pronamespace='public'::regnamespace and proname like 'nf_licenca_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.nome);
  execute format('grant execute on function %s to service_role',f.nome);
 end loop;
end $$;
commit;
