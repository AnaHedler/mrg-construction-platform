-- Engerama Hub - Supabase schema compartilhado com RLS
-- Rode este arquivo no SQL Editor do Supabase.
-- Nao use chave privilegiada no app frontend. Use apenas anon/publishable key.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Engerama')
on conflict (id) do update set name = excluded.name;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'viewer',
  phone text,
  all_projects boolean not null default false,
  project_ids text[] not null default '{}',
  modules text[] not null default array['insumos'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists org_id uuid references public.organizations(id)
  default '00000000-0000-4000-8000-000000000001';

update public.profiles
set org_id = '00000000-0000-4000-8000-000000000001'
where org_id is null;

alter table public.profiles
  alter column org_id set not null;

create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  collection text not null check (collection in ('projects','users','insumoOrders','insumoUnits')),
  record_key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_records
  add column if not exists org_id uuid references public.organizations(id)
  default '00000000-0000-4000-8000-000000000001';

update public.app_records
set org_id = '00000000-0000-4000-8000-000000000001'
where org_id is null;

alter table public.app_records
  alter column org_id set not null;

delete from public.app_records ar
using (
  select id,
         row_number() over (
           partition by org_id, collection, record_key
           order by updated_at desc, created_at desc, id desc
         ) as rn
  from public.app_records
) duplicates
where ar.id = duplicates.id
  and duplicates.rn > 1;

create unique index if not exists app_records_org_record_key_idx
on public.app_records (org_id, collection, record_key);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select org_id from public.profiles where id = auth.uid()),
    '00000000-0000-4000-8000-000000000001'::uuid
  );
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists app_records_touch_updated_at on public.app_records;
create trigger app_records_touch_updated_at
before update on public.app_records
for each row execute function public.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.app_records enable row level security;
alter table public.app_records force row level security;

drop policy if exists "organizations_select_same_org" on public.organizations;
create policy "organizations_select_same_org"
on public.organizations for select
to authenticated
using (id = public.current_org_id());

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
drop policy if exists "profiles_select_same_org" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_delete_self" on public.profiles;

create policy "profiles_select_same_org"
on public.profiles for select
to authenticated
using (org_id = public.current_org_id());

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and org_id = public.current_org_id());

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and org_id = public.current_org_id());

create policy "profiles_delete_self"
on public.profiles for delete
to authenticated
using (id = auth.uid());

drop policy if exists "app_records_select_own" on public.app_records;
drop policy if exists "app_records_insert_own" on public.app_records;
drop policy if exists "app_records_update_own" on public.app_records;
drop policy if exists "app_records_delete_own" on public.app_records;
drop policy if exists "app_records_select_same_org" on public.app_records;
drop policy if exists "app_records_insert_same_org" on public.app_records;
drop policy if exists "app_records_update_same_org" on public.app_records;
drop policy if exists "app_records_delete_same_org" on public.app_records;

create policy "app_records_select_same_org"
on public.app_records for select
to authenticated
using (org_id = public.current_org_id());

create policy "app_records_insert_same_org"
on public.app_records for insert
to authenticated
with check (owner_id = auth.uid() and org_id = public.current_org_id());

create policy "app_records_update_same_org"
on public.app_records for update
to authenticated
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy "app_records_delete_same_org"
on public.app_records for delete
to authenticated
using (org_id = public.current_org_id());
