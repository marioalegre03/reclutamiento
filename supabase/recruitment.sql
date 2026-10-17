create table if not exists public.recruitment_applications (
 id uuid primary key, created_at timestamptz not null default now(), nombre text not null, email text not null,
 telefono text not null default '', puesto text not null, emisora text not null default '', ciudad text not null default '', experiencia text not null default '', mensaje text not null default '',
 consent_at timestamptz not null default now(), ip_hash text not null, email_status text not null default 'pending', email_message_id text
);
alter table public.recruitment_applications enable row level security;
revoke all on public.recruitment_applications from anon, authenticated;
create index if not exists recruitment_ip_time on public.recruitment_applications(ip_hash,created_at);
create or replace function public.reserve_recruitment(p_id uuid,p_ip text,p_data jsonb) returns text language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_ip,0));
 if exists(select 1 from recruitment_applications where id=p_id) then
   if exists(select 1 from recruitment_applications where id=p_id and ip_hash=p_ip and email_status='failed') then
     update recruitment_applications set email_status='pending' where id=p_id; return 'retry';
   end if;
   return 'duplicate';
 end if;
 if (select count(*) from recruitment_applications where ip_hash=p_ip and created_at>now()-interval '1 hour')>=3 or (select count(*) from recruitment_applications where created_at>now()-interval '1 day')>=150 then return 'limited'; end if;
 insert into recruitment_applications(id,ip_hash,nombre,email,telefono,puesto,emisora,ciudad,experiencia,mensaje)
 values(p_id,p_ip,p_data->>'nombre',p_data->>'email',p_data->>'telefono',p_data->>'puesto',p_data->>'emisora',p_data->>'ciudad',p_data->>'experiencia',p_data->>'mensaje');
 return 'reserved';
end; $$;
revoke all on function public.reserve_recruitment(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_recruitment(uuid,text,jsonb) to service_role;
