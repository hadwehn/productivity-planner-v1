-- Ejecutar UNA VEZ, en un proyecto nuevo, como propietario en SQL Editor.
-- No borra ni reemplaza tablas existentes. Una colisión de nombres aborta todo.
begin;

create table public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision uuid not null,
  schema_version integer not null default 2 check (schema_version = 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint state_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['h','hl','m','ev','w','d','cfg']
    and jsonb_typeof(data->'h') = 'array'
    and jsonb_typeof(data->'hl') = 'object'
    and jsonb_typeof(data->'m') = 'object'
    and jsonb_typeof(data->'ev') = 'object'
    and jsonb_typeof(data->'w') = 'object'
    and jsonb_typeof(data->'d') = 'object'
    and jsonb_typeof(data->'cfg') = 'object'
    and octet_length(data::text) <= 10485760
  )
);
create table public.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'admin'),
  assigned_at timestamptz not null default now()
);
alter table public.planner_states enable row level security;
alter table public.app_roles enable row level security;
create policy own_state on public.planner_states for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_role on public.app_roles for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.planner_states, public.app_roles from anon, authenticated;
grant select on public.planner_states, public.app_roles to authenticated;
-- No INSERT/UPDATE/DELETE directo. La única escritura es la RPC siguiente.

create function public.save_planner(p_data jsonb, p_expected uuid, p_revision uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  affected integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_revision is null or p_revision is not distinct from p_expected then
    raise exception 'INVALID_REVISION' using errcode = '22023';
  end if;
  -- Compare-and-swap: el control se realiza EN la base, de forma atómica.
  if p_expected is null then
    insert into public.planner_states(user_id, data, revision)
      values(uid, p_data, p_revision) on conflict(user_id) do nothing;
  else
    update public.planner_states
      set data = p_data, revision = p_revision, updated_at = now()
      where user_id = uid and revision = p_expected;
  end if;
  get diagnostics affected = row_count;
  if affected = 0 then
    -- Un reintento de la MISMA operación ya confirmada no vuelve a escribir.
    if exists(select 1 from public.planner_states where user_id=uid and revision=p_revision) then
      return jsonb_build_object('revision',p_revision);
    end if;
    raise exception 'STATE_CONFLICT' using errcode = 'P0001';
  end if;
  return jsonb_build_object('revision',p_revision);
end;
$$;
revoke all on function public.save_planner(jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.save_planner(jsonb,uuid,uuid) to authenticated;

create function public.operational_metrics()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.app_roles where user_id=auth.uid() and role='admin'
  ) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return (
    select jsonb_build_object('cuentas_con_agenda',count(*),
      'agendas_actualizadas_7_dias',count(*) filter(where updated_at>now()-interval '7 days'))
    from public.planner_states
  );
end;
$$;
revoke all on function public.operational_metrics() from public, anon, authenticated;
grant execute on function public.operational_metrics() to authenticated;
commit;
