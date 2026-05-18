-- Engerama Hub - Supabase multiusuario real com RLS
-- Rode este arquivo no SQL Editor do Supabase.
-- Use somente anon/publishable key no front-end. Nunca use chave privilegiada no app.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.usuario_perfil as enum ('admin','compras','financeiro','obra','visualizador');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.pedido_status as enum ('pendente','em_rota','concluido','cancelado');
exception when duplicate_object then null;
end $$;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  username text not null,
  nome text not null,
  email text not null,
  telefone text,
  perfil public.usuario_perfil not null default 'visualizador',
  ativo boolean not null default true,
  todas_obras boolean not null default false,
  obras_permitidas uuid[] not null default '{}',
  modulos text[] not null default array['insumos'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo_externo text not null,
  codigo text,
  nome text not null,
  status text not null default 'ativo',
  endereco text,
  cidade text,
  estado text,
  orcamento_total numeric(14,2),
  inicio date,
  termino date,
  descricao text,
  dados jsonb not null default '{}'::jsonb,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_empresa_codigo_externo_unique unique (empresa_id, codigo_externo)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  codigo_externo text not null,
  numero text not null,
  status public.pedido_status not null default 'pendente',
  solicitado_por uuid references public.usuarios(id) on delete set null,
  solicitado_por_nome text,
  recebido_por uuid references public.usuarios(id) on delete set null,
  recebido_por_nome text,
  observacao text,
  precisa_em date,
  anexos jsonb not null default '[]'::jsonb,
  dados jsonb not null default '{}'::jsonb,
  solicitado_em timestamptz not null default now(),
  recebido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedidos_empresa_codigo_externo_unique unique (empresa_id, codigo_externo)
);

create table if not exists public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  material text not null,
  quantidade numeric(14,3) not null default 1,
  unidade text not null default 'peça',
  observacao text,
  anexos jsonb not null default '[]'::jsonb,
  ordem integer not null default 1,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  comprador_id uuid references public.usuarios(id) on delete set null,
  comprador_nome text,
  fornecedor_nome text not null,
  fornecedor_telefone text,
  fornecedor_endereco text,
  preco_cotado numeric(14,2),
  prazo_entrega text,
  data_compra date not null default current_date,
  comentario text,
  anexos jsonb not null default '[]'::jsonb,
  nfe_anexo jsonb,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compras_pedido_unique unique (pedido_id)
);

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nome text,
  tabela text not null,
  registro_id uuid,
  acao text not null,
  antes jsonb,
  depois jsonb,
  detalhes text,
  created_at timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete cascade,
  tipo text not null default 'info',
  titulo text not null,
  mensagem text not null,
  lida boolean not null default false,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.empresas (id, nome, slug)
values ('00000000-0000-4000-8000-000000000001', 'Engerama', 'engerama')
on conflict (id) do update set nome = excluded.nome, slug = excluded.slug;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.empresa_id from public.usuarios u where u.id = auth.uid() and u.ativo = true limit 1;
$$;

create or replace function public.current_usuario_perfil()
returns public.usuario_perfil
language sql
stable
security definer
set search_path = public
as $$
  select u.perfil from public.usuarios u where u.id = auth.uid() and u.ativo = true limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_perfil() = 'admin'::public.usuario_perfil, false);
$$;

create or replace function public.has_perfil(perfis public.usuario_perfil[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_perfil() = any(perfis), false);
$$;

create or replace function public.can_access_obra(obra uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.ativo = true
      and (
        u.perfil in ('admin','compras','financeiro')
        or u.todas_obras = true
        or obra = any(u.obras_permitidas)
      )
  );
$$;

drop trigger if exists empresas_touch_updated_at on public.empresas;
create trigger empresas_touch_updated_at before update on public.empresas
for each row execute function public.touch_updated_at();

drop trigger if exists usuarios_touch_updated_at on public.usuarios;
create trigger usuarios_touch_updated_at before update on public.usuarios
for each row execute function public.touch_updated_at();

drop trigger if exists obras_touch_updated_at on public.obras;
create trigger obras_touch_updated_at before update on public.obras
for each row execute function public.touch_updated_at();

drop trigger if exists pedidos_touch_updated_at on public.pedidos;
create trigger pedidos_touch_updated_at before update on public.pedidos
for each row execute function public.touch_updated_at();

drop trigger if exists itens_pedido_touch_updated_at on public.itens_pedido;
create trigger itens_pedido_touch_updated_at before update on public.itens_pedido
for each row execute function public.touch_updated_at();

drop trigger if exists compras_touch_updated_at on public.compras;
create trigger compras_touch_updated_at before update on public.compras
for each row execute function public.touch_updated_at();

create index if not exists usuarios_empresa_idx on public.usuarios (empresa_id);
create index if not exists usuarios_perfil_idx on public.usuarios (empresa_id, perfil);
create unique index if not exists usuarios_empresa_username_unique on public.usuarios (empresa_id, lower(username));
create unique index if not exists usuarios_empresa_email_unique on public.usuarios (empresa_id, lower(email));
create index if not exists obras_empresa_idx on public.obras (empresa_id);
create index if not exists pedidos_empresa_obra_idx on public.pedidos (empresa_id, obra_id, status);
create index if not exists pedidos_solicitado_por_idx on public.pedidos (solicitado_por);
create index if not exists itens_pedido_pedido_idx on public.itens_pedido (pedido_id);
create index if not exists compras_empresa_pedido_idx on public.compras (empresa_id, pedido_id);
create index if not exists auditoria_empresa_registro_idx on public.auditoria (empresa_id, tabela, registro_id);
create index if not exists notificacoes_usuario_idx on public.notificacoes (empresa_id, usuario_id, lida);

alter table public.empresas enable row level security;
alter table public.empresas force row level security;
alter table public.usuarios enable row level security;
alter table public.usuarios force row level security;
alter table public.obras enable row level security;
alter table public.obras force row level security;
alter table public.pedidos enable row level security;
alter table public.pedidos force row level security;
alter table public.itens_pedido enable row level security;
alter table public.itens_pedido force row level security;
alter table public.compras enable row level security;
alter table public.compras force row level security;
alter table public.auditoria enable row level security;
alter table public.auditoria force row level security;
alter table public.notificacoes enable row level security;
alter table public.notificacoes force row level security;

drop policy if exists empresas_select_mesma_empresa on public.empresas;
create policy empresas_select_mesma_empresa on public.empresas
for select to authenticated
using (id = public.current_empresa_id());

drop policy if exists empresas_admin_update on public.empresas;
create policy empresas_admin_update on public.empresas
for update to authenticated
using (id = public.current_empresa_id() and public.is_admin())
with check (id = public.current_empresa_id() and public.is_admin());

drop policy if exists usuarios_select_seguro on public.usuarios;
create policy usuarios_select_seguro on public.usuarios
for select to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (id = auth.uid() or public.has_perfil(array['admin','compras']::public.usuario_perfil[]))
);

drop policy if exists usuarios_admin_insert on public.usuarios;
create policy usuarios_admin_insert on public.usuarios
for insert to authenticated
with check (empresa_id = public.current_empresa_id() and public.is_admin());

drop policy if exists usuarios_admin_update on public.usuarios;
create policy usuarios_admin_update on public.usuarios
for update to authenticated
using (empresa_id = public.current_empresa_id() and public.is_admin())
with check (empresa_id = public.current_empresa_id() and public.is_admin());

drop policy if exists usuarios_admin_delete on public.usuarios;
create policy usuarios_admin_delete on public.usuarios
for delete to authenticated
using (empresa_id = public.current_empresa_id() and public.is_admin() and id <> auth.uid());

drop policy if exists obras_select_permitidas on public.obras;
create policy obras_select_permitidas on public.obras
for select to authenticated
using (empresa_id = public.current_empresa_id() and public.can_access_obra(id));

drop policy if exists obras_admin_financeiro_write on public.obras;
create policy obras_admin_financeiro_write on public.obras
for all to authenticated
using (empresa_id = public.current_empresa_id() and public.has_perfil(array['admin','financeiro']::public.usuario_perfil[]))
with check (empresa_id = public.current_empresa_id() and public.has_perfil(array['admin','financeiro']::public.usuario_perfil[]));

drop policy if exists pedidos_select_permitidos on public.pedidos;
create policy pedidos_select_permitidos on public.pedidos
for select to authenticated
using (empresa_id = public.current_empresa_id() and public.can_access_obra(obra_id));

drop policy if exists pedidos_insert_obra_compras_admin on public.pedidos;
create policy pedidos_insert_obra_compras_admin on public.pedidos
for insert to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.can_access_obra(obra_id)
  and public.has_perfil(array['admin','obra','compras']::public.usuario_perfil[])
);

drop policy if exists pedidos_update_fluxo on public.pedidos;
create policy pedidos_update_fluxo on public.pedidos
for update to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.can_access_obra(obra_id)
  and public.has_perfil(array['admin','obra','compras']::public.usuario_perfil[])
)
with check (
  empresa_id = public.current_empresa_id()
  and public.can_access_obra(obra_id)
  and public.has_perfil(array['admin','obra','compras']::public.usuario_perfil[])
);

drop policy if exists pedidos_admin_delete on public.pedidos;
create policy pedidos_admin_delete on public.pedidos
for delete to authenticated
using (empresa_id = public.current_empresa_id() and public.is_admin());

drop policy if exists itens_select_permitidos on public.itens_pedido;
create policy itens_select_permitidos on public.itens_pedido
for select to authenticated
using (
  empresa_id = public.current_empresa_id()
  and exists (select 1 from public.pedidos p where p.id = pedido_id and public.can_access_obra(p.obra_id))
);

drop policy if exists itens_write_fluxo on public.itens_pedido;
create policy itens_write_fluxo on public.itens_pedido
for all to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.has_perfil(array['admin','obra','compras']::public.usuario_perfil[])
  and exists (select 1 from public.pedidos p where p.id = pedido_id and public.can_access_obra(p.obra_id))
)
with check (
  empresa_id = public.current_empresa_id()
  and public.has_perfil(array['admin','obra','compras']::public.usuario_perfil[])
  and exists (select 1 from public.pedidos p where p.id = pedido_id and public.can_access_obra(p.obra_id))
);

drop policy if exists compras_select_compras_admin_obra on public.compras;
create policy compras_select_compras_admin_obra on public.compras
for select to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.has_perfil(array['admin','compras','financeiro']::public.usuario_perfil[])
    or exists (select 1 from public.pedidos p where p.id = pedido_id and public.can_access_obra(p.obra_id))
  )
);

drop policy if exists compras_write_compras_admin on public.compras;
create policy compras_write_compras_admin on public.compras
for all to authenticated
using (empresa_id = public.current_empresa_id() and public.has_perfil(array['admin','compras']::public.usuario_perfil[]))
with check (empresa_id = public.current_empresa_id() and public.has_perfil(array['admin','compras']::public.usuario_perfil[]));

drop policy if exists auditoria_select_mesma_empresa on public.auditoria;
create policy auditoria_select_mesma_empresa on public.auditoria
for select to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.has_perfil(array['admin','compras','financeiro']::public.usuario_perfil[])
);

drop policy if exists auditoria_insert_mesma_empresa on public.auditoria;
create policy auditoria_insert_mesma_empresa on public.auditoria
for insert to authenticated
with check (empresa_id = public.current_empresa_id());

drop policy if exists notificacoes_select_proprias on public.notificacoes;
create policy notificacoes_select_proprias on public.notificacoes
for select to authenticated
using (empresa_id = public.current_empresa_id() and (usuario_id = auth.uid() or usuario_id is null or public.is_admin()));

drop policy if exists notificacoes_insert_mesma_empresa on public.notificacoes;
create policy notificacoes_insert_mesma_empresa on public.notificacoes
for insert to authenticated
with check (empresa_id = public.current_empresa_id());

drop policy if exists notificacoes_update_proprias on public.notificacoes;
create policy notificacoes_update_proprias on public.notificacoes
for update to authenticated
using (empresa_id = public.current_empresa_id() and (usuario_id = auth.uid() or public.is_admin()))
with check (empresa_id = public.current_empresa_id() and (usuario_id = auth.uid() or public.is_admin()));

-- Admin inicial seguro:
-- 1. Crie o usuario pelo Supabase Auth, sem salvar senha em tabelas publicas.
-- 2. Copie o UUID do usuario criado.
-- 3. Rode o INSERT abaixo trocando <AUTH_USER_ID> e <EMAIL_DO_ADMIN>.
--
-- insert into public.usuarios (
--   id, empresa_id, username, nome, email, perfil, ativo, todas_obras, modulos
-- ) values (
--   '<AUTH_USER_ID>'::uuid,
--   '00000000-0000-4000-8000-000000000001',
--   'admin',
--   'Administrador',
--   '<EMAIL_DO_ADMIN>',
--   'admin',
--   true,
--   true,
--   array['obras','relatorio','insumos','usuarios']
-- )
-- on conflict (id) do update set
--   perfil = 'admin',
--   ativo = true,
--   todas_obras = true,
--   modulos = excluded.modulos;
