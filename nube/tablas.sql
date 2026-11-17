-- Tablas de Atlas en Supabase (fase 3, parte B).
-- Se pega una sola vez en Supabase: menú «SQL Editor» → «New query» → pegar todo → «Run».
-- Se puede ejecutar más de una vez sin romper nada.

-- 1) «Mi lista»: una fila por empresa guardada.
create table if not exists public.lista (
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  simbolo text not null check (char_length(simbolo) between 1 and 12),
  creado timestamptz not null default now(),
  primary key (usuario, simbolo)
);

-- 2) Alertas: una fila por alerta. Las columnas «aviso_…» guardan la última vez que saltó.
create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  simbolo text not null check (char_length(simbolo) between 1 and 12),
  tipo text not null check (tipo in ('baja_de', 'sube_de', 'mov_dia', 'cerca_min')),
  valor numeric,
  creada timestamptz not null default now(),
  comprobada date,
  cumplida boolean not null default false,
  aviso_fecha date,
  aviso_precio numeric,
  aviso_cambio numeric,
  aviso_visto boolean not null default true
);

create index if not exists alertas_usuario on public.alertas (usuario);

-- 3) Seguridad: cada persona solo puede ver y cambiar sus propias filas.
alter table public.lista enable row level security;
alter table public.alertas enable row level security;

drop policy if exists "lista propia" on public.lista;
create policy "lista propia" on public.lista
  for all to authenticated
  using (usuario = auth.uid())
  with check (usuario = auth.uid());

drop policy if exists "alertas propias" on public.alertas;
create policy "alertas propias" on public.alertas
  for all to authenticated
  using (usuario = auth.uid())
  with check (usuario = auth.uid());
