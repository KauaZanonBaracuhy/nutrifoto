-- Agregados técnicos sem identidade, conteúdo de refeições, IP ou tokens.
begin;
create table if not exists public.nf_metricas (
 minuto timestamptz not null,
 rota text not null check(rota in ('/api/conta','/api/dados','/api/ia','/api/assinatura','/api/imagens','/api/webhook','/api/outros')),
 status integer not null check(status between 100 and 599),
 faixa_ms integer not null check(faixa_ms in (50,100,250,500,1000,2500,5000,10000,60000)),
 quantidade bigint not null default 1,
 duracao_total_ms bigint not null default 0,
 primary key(minuto,rota,status,faixa_ms)
);
alter table public.nf_metricas enable row level security;
revoke all on public.nf_metricas from public,anon,authenticated;

create or replace function public.nf_registrar_metrica(p_rota text,p_status integer,p_duracao_ms integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_faixa integer;
begin
 if p_duracao_ms<0 or p_duracao_ms>60000 then raise exception 'Duração inválida'; end if;
 select min(faixa) into v_faixa from unnest(array[50,100,250,500,1000,2500,5000,10000,60000]) faixa where faixa>=p_duracao_ms;
 insert into public.nf_metricas(minuto,rota,status,faixa_ms,duracao_total_ms)
 values(date_trunc('minute',now()),p_rota,p_status,v_faixa,p_duracao_ms)
 on conflict(minuto,rota,status,faixa_ms) do update set quantidade=public.nf_metricas.quantidade+1,duracao_total_ms=public.nf_metricas.duracao_total_ms+excluded.duracao_total_ms;
end;
$$;

create or replace function public.nf_resumo_operacao(p_minutos integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_http jsonb; v_ia jsonb; v_storage jsonb;
begin
 if p_minutos<1 or p_minutos>360 then raise exception 'Janela inválida'; end if;
 select coalesce(jsonb_agg(linha),'[]'::jsonb) into v_http from (
 select rota,status,faixa_ms,sum(quantidade) quantidade,sum(duracao_total_ms) duracao_total_ms
 from public.nf_metricas where minuto>=now()-make_interval(mins=>p_minutos) group by rota,status,faixa_ms
 ) linha;
 select jsonb_build_object('chamadas',coalesce(sum(chamadas),0),'tokens',coalesce(sum(tokens),0)) into v_ia from public.nf_consumo where mes=date_trunc('month',now() at time zone 'UTC')::date;
 select v_ia || jsonb_build_object('custo_confirmado_usd',coalesce(sum(custo) filter(where estado='confirmado'),0),'custos_desconhecidos',count(*) filter(where estado='desconhecido'),'reservas_pendentes',count(*) filter(where estado='reservado'),'reserva_pendente_usd',coalesce(sum(reserva) filter(where estado in ('reservado','desconhecido')),0)) into v_ia from public.nf_ia_custos where mes=date_trunc('month',now() at time zone 'UTC')::date;
 select jsonb_build_object('bytes',coalesce(sum(tamanho),0),'objetos',count(*),'pendentes',count(*) filter(where not pronta)) into v_storage from public.nf_imagens;
 return jsonb_build_object('janela_minutos',p_minutos,'http',v_http,'ia',v_ia,'storage',v_storage,'gerado_em',now());
end;
$$;

create or replace function public.nf_limpar_metricas(p_dias integer default 30)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_removidas bigint;
begin
 if p_dias<1 or p_dias>365 then raise exception 'Retenção inválida'; end if;
 delete from public.nf_metricas where minuto<now()-make_interval(days=>p_dias);
 get diagnostics v_removidas=row_count;
 return v_removidas;
end;
$$;
revoke all on function public.nf_registrar_metrica(text,integer,integer),public.nf_resumo_operacao(integer),public.nf_limpar_metricas(integer) from public,anon,authenticated;
grant execute on function public.nf_registrar_metrica(text,integer,integer),public.nf_resumo_operacao(integer),public.nf_limpar_metricas(integer) to service_role;
commit;
