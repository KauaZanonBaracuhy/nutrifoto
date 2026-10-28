-- Concessão única, independente de Asaas, sem alterar dados alimentares ou compras.
begin;
create table public.nf_licenca_proprietario (
  unico boolean primary key default true check (unico),
  licenca uuid unique not null references public.nf_licencas(id),
  concedida_em timestamptz not null default now(), revogada_em timestamptz
);
alter table public.nf_licenca_proprietario enable row level security;
revoke all on public.nf_licenca_proprietario from public,anon,authenticated;

create function public.nf_licenca_proprietario_ativar(p_id uuid,p_dispositivo text,p_dias integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare registro nf_licencas; concessao nf_licenca_proprietario;
begin
  -- Mesmo lock da transferência: conferir dispositivo e conceder é uma única transação.
  perform pg_advisory_xact_lock(7419001);
  if p_dias is null or p_dias<1 or p_dias>365 then return jsonb_build_object('erro','Validade do proprietário indisponível.','status',503); end if;
  select * into registro from nf_licencas where id=p_id and chave=p_dispositivo for update;
  if not found then return jsonb_build_object('erro','Dispositivo alterado. Atualize a ativação.','status',403); end if;
  select * into concessao from nf_licenca_proprietario where unico;
  if found then
    if concessao.revogada_em is not null then return jsonb_build_object('erro','Licença do proprietário revogada. Procure o responsável.','status',403); end if;
    if concessao.licenca<>p_id then return jsonb_build_object('erro','A licença do proprietário já está vinculada. Use a recuperação do aparelho anterior.','status',409); end if;
    return to_jsonb(registro);
  end if;
  if coalesce((registro.estado->>'bloqueada')::boolean,false) or coalesce(registro.estado->'compras','{}'::jsonb)<>'{}'::jsonb then
    return jsonb_build_object('erro','Este dispositivo possui compra ou bloqueio. Procure o suporte.','status',409);
  end if;
  update nf_licencas set estado=estado||jsonb_build_object('origem','proprietario','plano','completo','validade',now()+make_interval(days=>p_dias)),revisao=revisao+1 where id=p_id returning * into registro;
  insert into nf_licenca_proprietario(unico,licenca) values(true,p_id);
  return to_jsonb(registro);
end; $$;

create function public.nf_licenca_proprietario_revogar() returns boolean language plpgsql security definer set search_path=public as $$
declare dono uuid;
begin
  perform pg_advisory_xact_lock(7419001);
  update nf_licenca_proprietario set revogada_em=coalesce(revogada_em,now()) where unico returning licenca into dono;
  if not found then return false; end if;
  update nf_licencas set estado=estado||'{"bloqueada":true}'::jsonb,revisao=revisao+1 where id=dono;
  return true;
end; $$;

create or replace function public.nf_licenca_transferir(p_atual uuid,p_codigo text,p_chave text,p_publica text) returns jsonb language plpgsql security definer set search_path=public as $$
declare origem nf_licencas; destino nf_licencas;
begin
 perform pg_advisory_xact_lock(7419001);
 select * into origem from nf_licencas where recuperacao=p_codigo for update;
 if not found or origem.id=p_atual then return jsonb_build_object('erro','Código de recuperação inválido.','status',403); end if;
 select * into destino from nf_licencas where id=p_atual and chave=p_chave for update;
 if not found or destino.estado->'compras'<>'{}'::jsonb or destino.estado->>'origem'='proprietario' then return jsonb_build_object('erro','Este dispositivo já possui licença ou compras. Procure o suporte.','status',409); end if;
 delete from nf_licencas where id=p_atual;
 update nf_licencas set chave=p_chave,publica=p_publica,recuperacao=null,revisao=revisao+1 where id=origem.id returning * into origem;
 return to_jsonb(origem);
end; $$;
revoke all on function public.nf_licenca_proprietario_ativar(uuid,text,integer),public.nf_licenca_proprietario_revogar() from public,anon,authenticated;
grant execute on function public.nf_licenca_proprietario_ativar(uuid,text,integer),public.nf_licenca_proprietario_revogar() to service_role;
commit;
