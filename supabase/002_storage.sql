-- Homologação Supabase: bucket privado, acesso exclusivamente pelo servidor.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nutrifoto-imagens','nutrifoto-imagens',false,1000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=1000000,allowed_mime_types=excluded.allowed_mime_types;
-- Não criar policy de leitura/escrita anônima ou authenticated em storage.objects.
