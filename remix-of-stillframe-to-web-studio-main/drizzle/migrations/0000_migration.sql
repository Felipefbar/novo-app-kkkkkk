create type public.app_role as enum ('admin', 'staff');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Staff accounts are created by the owner (public sign-up disabled); every new account gets the staff role.
create or replace function public.grant_staff_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'staff') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created_staff after insert on auth.users
  for each row execute function public.grant_staff_role();

create sequence public.triage_ticket_seq;

create table public.triage_records (
  id uuid primary key default gen_random_uuid(),
  ticket text not null,
  dni text not null default '',
  level text not null,
  status text not null default 'En Espera',
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index triage_records_dni_idx on public.triage_records (dni);
create index triage_records_status_idx on public.triage_records (status);
grant select, update on public.triage_records to authenticated;
grant all on public.triage_records to service_role;
alter table public.triage_records enable row level security;
create policy "Staff read records" on public.triage_records for select to authenticated using (public.has_role(auth.uid(), 'staff'));
create policy "Staff update records" on public.triage_records for update to authenticated
  using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'));

create or replace function public.touch_triage_record()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.level := coalesce(new.record->>'level', new.level);
  new.status := coalesce(new.record->>'status', new.status);
  return new;
end $$;
create trigger triage_records_touch before update on public.triage_records
  for each row execute function public.touch_triage_record();

-- Public kiosk registration: patients can only add their own record, never read others.
create or replace function public.register_patient(_record jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _id uuid := gen_random_uuid();
  _level text := _record->>'level';
  _ticket text;
  _now bigint := (extract(epoch from now()) * 1000)::bigint;
  _full jsonb;
begin
  if coalesce((_record->>'consent')::boolean, false) is not true then
    raise exception 'Se requiere consentimiento informado';
  end if;
  if _level not in ('Rojo','Naranja','Amarillo','Verde','Azul') then
    raise exception 'Nivel inválido';
  end if;
  if length(_record::text) > 50000 then raise exception 'Registro demasiado grande'; end if;
  _ticket := left(_level, 1) || '-' || lpad(nextval('public.triage_ticket_seq')::text, 3, '0');
  _full := _record || jsonb_build_object('id', _id, 'ticket', _ticket, 'createdAt', _now, 'consentAt', _now, 'status', 'En Espera');
  insert into public.triage_records (id, ticket, dni, level, status, record)
  values (_id, _ticket, coalesce(_record->>'dni', ''), _level, 'En Espera', _full);
  return _full;
end $$;
revoke all on function public.register_patient(jsonb) from public;
grant execute on function public.register_patient(jsonb) to anon, authenticated;

-- Waiting-room display: anonymized queue only.
create or replace function public.waiting_room_queue()
returns table (id uuid, ticket text, initials text, dni_tail text, level text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.ticket,
    (select string_agg(left(w, 1), '.') || '.' from regexp_split_to_table(trim(coalesce(r.record->>'name', '')), '\s+') w where w <> ''),
    right(r.dni, 3), r.level, r.status, r.created_at
  from public.triage_records r
  where r.status <> 'Atendido'
  order by r.created_at
$$;
revoke all on function public.waiting_room_queue() from public;
grant execute on function public.waiting_room_queue() to anon, authenticated;

alter publication supabase_realtime add table public.triage_records;