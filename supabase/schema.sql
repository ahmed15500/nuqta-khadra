create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('collector_store','user','partner_store','admin')),
  points numeric(12,1) not null default 0,
  store_name text,
  store_category text not null default 'other_services',
  photo_url text,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists store_category text not null default 'other_services';

-- Existing deployments may already have policies referencing profiles.points.
-- Drop those policies first so column type migration can succeed.
do $$
declare
  p record;
begin
  for p in
    select pol.polname
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname = 'profiles'
      and (
        coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ilike '%points%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%points%'
      )
  loop
    execute format('drop policy if exists %I on public.profiles', p.polname);
  end loop;
end;
$$;

create table if not exists public.waste_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  points_per_kg numeric(10,2) not null,
  icon text,
  updated_at timestamptz not null default now()
);

create table if not exists public.waste_transactions (
  id uuid primary key default gen_random_uuid(),
  collector_store_id uuid not null references public.profiles(id),
  user_id uuid not null references public.profiles(id),
  waste_type_id uuid not null references public.waste_types(id),
  weight_kg numeric(10,2) not null check (weight_kg > 0),
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.point_transfers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id),
  to_id uuid not null references public.profiles(id),
  points numeric(12,1) not null check (points > 0),
  transfer_type text not null check (transfer_type in ('user_to_user','user_to_store')),
  sender_name text,
  sender_phone text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.point_cash_rates (
  id integer primary key default 1 check (id = 1),
  user_cash_per_point numeric(12,4) not null default 0,
  shop_cash_per_point numeric(12,4) not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_settlements (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(id),
  beneficiary_role text not null check (beneficiary_role in ('user','partner_store','collector_store')),
  points_before numeric(12,1) not null check (points_before > 0),
  points_settled numeric(12,1) not null check (points_settled > 0),
  cash_per_point numeric(12,4) not null check (cash_per_point >= 0),
  cash_amount numeric(14,2) not null check (cash_amount >= 0),
  paid_by_admin_id uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

-- Allow decimal balances/transfers (0.1 step) on existing projects.
alter table public.profiles
  alter column points type numeric(12,1)
  using round(points::numeric, 1),
  alter column points set default 0;

alter table public.point_transfers
  alter column points type numeric(12,1)
  using round(points::numeric, 1);

alter table public.point_transfers add column if not exists sender_name text;
alter table public.point_transfers add column if not exists sender_phone text;

update public.point_transfers pt
set
  sender_name = coalesce(pt.sender_name, p.name),
  sender_phone = coalesce(pt.sender_phone, p.phone)
from public.profiles p
where pt.from_id = p.id
  and (pt.sender_name is null or pt.sender_phone is null);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_waste_transactions_user on public.waste_transactions(user_id);
create index if not exists idx_waste_transactions_collector on public.waste_transactions(collector_store_id);
create index if not exists idx_point_transfers_from on public.point_transfers(from_id);
create index if not exists idx_point_transfers_to on public.point_transfers(to_id);
create index if not exists idx_point_settlements_beneficiary on public.point_settlements(beneficiary_id);
create index if not exists idx_point_settlements_created_at on public.point_settlements(created_at desc);

insert into public.point_cash_rates (id, user_cash_per_point, shop_cash_per_point)
values (1, 1, 1)
on conflict (id) do nothing;

insert into public.waste_types (name, points_per_kg, icon)
values
  ('بلاستيك (زجاجات مياه)', 5, '🧴'),
  ('ورق', 3, '📄'),
  ('كرتون', 2, '📦'),
  ('كمبوست', 2, '🌱'),
  ('معادن', 10, '🔩'),
  ('زجاج', 4, '🫙'),
  ('مخلفات أخرى', 1, '♻️')
on conflict (name) do update
set points_per_kg = excluded.points_per_kg,
    icon = excluded.icon,
    updated_at = now();

alter table public.profiles enable row level security;
alter table public.waste_types enable row level security;
alter table public.waste_transactions enable row level security;
alter table public.point_transfers enable row level security;
alter table public.point_cash_rates enable row level security;
alter table public.point_settlements enable row level security;

-- Helper function to read current role without triggering RLS recursion.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_profile_role() to authenticated;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
on public.profiles for select
using (
  auth.uid() = id
  or public.current_profile_role() = 'admin'
);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = 'user'
  and (store_name is null or store_name = '')
);

drop policy if exists "profiles_self_insert_signup" on public.profiles;
drop policy if exists "profiles_self_insert_user" on public.profiles;
create policy "profiles_self_insert_signup"
on public.profiles for insert
with check (
  auth.uid() = id
  and role = 'user'
  and (store_name is null or store_name = '')
  and points = 0
);

drop policy if exists "profiles_collector_lookup_users" on public.profiles;
create policy "profiles_collector_lookup_users"
on public.profiles for select
using (
  role = 'user'
  and public.current_profile_role() = 'collector_store'
);

drop policy if exists "profiles_user_lookup_targets" on public.profiles;
create policy "profiles_user_lookup_targets"
on public.profiles for select
using (
  (
    (role = 'user' and id <> auth.uid())
    or role in ('partner_store', 'collector_store')
  )
  and public.current_profile_role() = 'user'
);

drop policy if exists "waste_types_read_all" on public.waste_types;
create policy "waste_types_read_all"
on public.waste_types for select
using (auth.role() = 'authenticated');

drop policy if exists "waste_types_admin_write" on public.waste_types;
create policy "waste_types_admin_write"
on public.waste_types for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "waste_transactions_insert_collector" on public.waste_transactions;
create policy "waste_transactions_insert_collector"
on public.waste_transactions for insert
with check (
  collector_store_id = auth.uid()
  and public.current_profile_role() = 'collector_store'
);

drop policy if exists "waste_transactions_read_related" on public.waste_transactions;
create policy "waste_transactions_read_related"
on public.waste_transactions for select
using (
  collector_store_id = auth.uid()
  or user_id = auth.uid()
  or public.current_profile_role() = 'admin'
);

drop policy if exists "point_transfers_insert_user" on public.point_transfers;
create policy "point_transfers_insert_user"
on public.point_transfers for insert
with check (
  from_id = auth.uid()
  and public.current_profile_role() = 'user'
);

drop policy if exists "point_transfers_read_related" on public.point_transfers;
create policy "point_transfers_read_related"
on public.point_transfers for select
using (
  from_id = auth.uid()
  or to_id = auth.uid()
  or public.current_profile_role() = 'admin'
);

drop policy if exists "point_cash_rates_admin_read" on public.point_cash_rates;
create policy "point_cash_rates_admin_read"
on public.point_cash_rates for select
using (public.current_profile_role() = 'admin');

drop policy if exists "point_cash_rates_admin_write" on public.point_cash_rates;
create policy "point_cash_rates_admin_write"
on public.point_cash_rates for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "point_settlements_admin_read" on public.point_settlements;
create policy "point_settlements_admin_read"
on public.point_settlements for select
using (public.current_profile_role() = 'admin');

drop policy if exists "point_settlements_admin_write" on public.point_settlements;
create policy "point_settlements_admin_write"
on public.point_settlements for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create or replace function public.award_waste_points(
  p_user_id uuid,
  p_waste_type_id uuid,
  p_weight_kg numeric
)
returns table(transaction_id uuid, points_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collector_id uuid := auth.uid();
  v_role text;
  v_points_per_kg numeric;
  v_points integer;
  v_tx_id uuid;
begin
  if v_collector_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_collector_id;
  if v_role <> 'collector_store' then
    raise exception 'Only collector stores can award waste points';
  end if;

  if p_weight_kg is null or p_weight_kg <= 0 then
    raise exception 'Weight must be > 0';
  end if;

  select points_per_kg into v_points_per_kg from public.waste_types where id = p_waste_type_id;
  if v_points_per_kg is null then
    raise exception 'Invalid waste type';
  end if;

  v_points := round(p_weight_kg * v_points_per_kg);

  insert into public.waste_transactions (
    collector_store_id,
    user_id,
    waste_type_id,
    weight_kg,
    points_awarded
  )
  values (
    v_collector_id,
    p_user_id,
    p_waste_type_id,
    p_weight_kg,
    v_points
  )
  returning id into v_tx_id;

  update public.profiles
  set points = points + v_points
  where id = p_user_id and role = 'user';

  if not found then
    raise exception 'Target user not found';
  end if;

  return query select v_tx_id, v_points;
end;
$$;

create or replace function public.transfer_points(
  p_to_id uuid,
  p_points numeric,
  p_transfer_type text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_id uuid := auth.uid();
  v_from_role text;
  v_from_points numeric(12,1);
  v_from_name text;
  v_from_phone text;
  v_to_role text;
  v_transfer_id uuid;
  v_points numeric(12,1);
begin
  if v_from_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_points is null or p_points <= 0 then
    raise exception 'Points must be > 0';
  end if;

  -- Transfers support decimal points in 0.1 steps only.
  v_points := round(p_points::numeric, 1);
  if p_points::numeric <> v_points then
    raise exception 'Points must use 0.1 steps only (example: 0.1, 1.5)';
  end if;

  if p_to_id = v_from_id then
    raise exception 'Cannot transfer to self';
  end if;

  select role, points, name, phone
  into v_from_role, v_from_points, v_from_name, v_from_phone
  from public.profiles
  where id = v_from_id
  for update;
  if v_from_role <> 'user' then
    raise exception 'Only users can transfer points';
  end if;

  if v_from_points < v_points then
    raise exception 'Insufficient points';
  end if;

  select role into v_to_role from public.profiles where id = p_to_id for update;
  if v_to_role is null then
    raise exception 'Recipient not found';
  end if;

  if p_transfer_type = 'user_to_user' and v_to_role <> 'user' then
    raise exception 'Recipient must be user';
  end if;

  if p_transfer_type = 'user_to_store' and v_to_role not in ('partner_store', 'collector_store') then
    raise exception 'Recipient must be partner or collector store';
  end if;

  if p_transfer_type not in ('user_to_user','user_to_store') then
    raise exception 'Invalid transfer type';
  end if;

  update public.profiles set points = points - v_points where id = v_from_id;
  update public.profiles set points = points + v_points where id = p_to_id;

  insert into public.point_transfers (from_id, to_id, points, transfer_type, sender_name, sender_phone, note)
  values (v_from_id, p_to_id, v_points, p_transfer_type, v_from_name, v_from_phone, p_note)
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

create or replace function public.admin_set_cash_rates(
  p_user_cash_per_point numeric,
  p_shop_cash_per_point numeric
)
returns table(user_cash_per_point numeric, shop_cash_per_point numeric, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can set cash rates';
  end if;

  if p_user_cash_per_point is null or p_user_cash_per_point < 0 then
    raise exception 'User cash rate must be >= 0';
  end if;

  if p_shop_cash_per_point is null or p_shop_cash_per_point < 0 then
    raise exception 'Shop cash rate must be >= 0';
  end if;

  insert into public.point_cash_rates (id, user_cash_per_point, shop_cash_per_point, updated_by, updated_at)
  values (1, p_user_cash_per_point, p_shop_cash_per_point, v_admin_id, now())
  on conflict (id) do update
  set
    user_cash_per_point = excluded.user_cash_per_point,
    shop_cash_per_point = excluded.shop_cash_per_point,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return query
  select r.user_cash_per_point, r.shop_cash_per_point, r.updated_at
  from public.point_cash_rates r
  where r.id = 1;
end;
$$;

create or replace function public.admin_settle_profile_points(
  p_profile_id uuid,
  p_note text default null
)
returns table(
  settlement_id uuid,
  beneficiary_id uuid,
  beneficiary_role text,
  points_settled numeric,
  cash_per_point numeric,
  cash_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_target_role text;
  v_points numeric(12,1);
  v_rate numeric(12,4);
  v_cash numeric(14,2);
  v_settlement_id uuid;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can settle balances';
  end if;

  select p.role, p.points
  into v_target_role, v_points
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if v_target_role is null then
    raise exception 'Target profile not found';
  end if;

  if v_target_role not in ('user','partner_store','collector_store') then
    raise exception 'Target role is not settleable';
  end if;

  if v_points is null or v_points <= 0 then
    raise exception 'No points to settle for this profile';
  end if;

  select
    case
      when v_target_role = 'user' then r.user_cash_per_point
      else r.shop_cash_per_point
    end
  into v_rate
  from public.point_cash_rates r
  where r.id = 1;

  if v_rate is null then
    raise exception 'Cash rates are not configured';
  end if;

  v_cash := round((v_points * v_rate)::numeric, 2);

  insert into public.point_settlements (
    beneficiary_id,
    beneficiary_role,
    points_before,
    points_settled,
    cash_per_point,
    cash_amount,
    paid_by_admin_id,
    note
  )
  values (
    p_profile_id,
    v_target_role,
    v_points,
    v_points,
    v_rate,
    v_cash,
    v_admin_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_settlement_id;

  update public.profiles
  set points = 0
  where id = p_profile_id;

  return query
  select
    v_settlement_id,
    p_profile_id,
    v_target_role,
    v_points,
    v_rate,
    v_cash;
end;
$$;

grant execute on function public.award_waste_points(uuid, uuid, numeric) to authenticated;
drop function if exists public.transfer_points(uuid, integer, text, text);
grant execute on function public.transfer_points(uuid, numeric, text, text) to authenticated;

create or replace function public.admin_upsert_store_profile(
  p_phone text,
  p_name text,
  p_store_name text,
  p_store_category text,
  p_role text,
  p_disabled boolean default false,
  p_photo_url text default null
)
returns table(profile_id uuid, role text, store_name text, store_category text, photo_url text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_email text;
  v_user_id uuid;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can manage store profiles';
  end if;

  if v_phone = '' then
    raise exception 'Phone is required';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Name is required';
  end if;

  if coalesce(trim(p_store_name), '') = '' then
    raise exception 'Store name is required';
  end if;

  if p_role not in ('collector_store', 'partner_store') then
    raise exception 'Role must be collector_store or partner_store';
  end if;

  if coalesce(trim(p_store_category), '') = '' then
    p_store_category := 'other_services';
  end if;

  v_email := lower(v_phone || '@nuqta.app');

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'No auth account found for this phone. Ask the store owner to register first.';
  end if;

  insert into public.profiles (id, name, phone, role, points, store_name, store_category, photo_url, disabled)
  values (v_user_id, trim(p_name), v_phone, p_role, 0, trim(p_store_name), p_store_category, nullif(trim(coalesce(p_photo_url, '')), ''), coalesce(p_disabled, false))
  on conflict (id) do update
  set
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    store_name = excluded.store_name,
    store_category = excluded.store_category,
    photo_url = excluded.photo_url,
    disabled = excluded.disabled;

  return query
  select p.id, p.role, p.store_name, p.store_category, p.photo_url
  from public.profiles p
  where p.id = v_user_id;
end;
$$;

create or replace function public.admin_delete_store_profile(
  p_profile_id uuid
)
returns table(profile_id uuid, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_target_role text;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can delete store profiles';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_profile_id
  for update;

  if v_target_role is null then
    raise exception 'Store profile not found';
  end if;

  if v_target_role not in ('collector_store', 'partner_store') then
    raise exception 'Target profile is not a store';
  end if;

  begin
    delete from public.profiles
    where id = p_profile_id;

    return query select p_profile_id, 'deleted'::text;
  exception
    when foreign_key_violation then
      update public.profiles
      set disabled = true
      where id = p_profile_id;

      return query select p_profile_id, 'disabled'::text;
  end;
end;
$$;

create or replace function public.admin_adjust_waste_transaction(
  p_transaction_id uuid,
  p_weight_kg numeric,
  p_points_awarded integer
)
returns table(transaction_id uuid, points_delta integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_prev_points integer;
  v_user_id uuid;
  v_delta integer;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can adjust transactions';
  end if;

  if p_weight_kg is null or p_weight_kg <= 0 then
    raise exception 'Weight must be > 0';
  end if;

  if p_points_awarded is null or p_points_awarded < 0 then
    raise exception 'Points must be >= 0';
  end if;

  select wt.user_id, wt.points_awarded
  into v_user_id, v_prev_points
  from public.waste_transactions wt
  where wt.id = p_transaction_id
  for update;

  if v_user_id is null then
    raise exception 'Transaction not found';
  end if;

  update public.waste_transactions
  set
    weight_kg = p_weight_kg,
    points_awarded = p_points_awarded
  where id = p_transaction_id;

  v_delta := p_points_awarded - v_prev_points;

  update public.profiles
  set points = points + v_delta
  where id = v_user_id;

  return query select p_transaction_id, v_delta;
end;
$$;

create or replace function public.admin_delete_waste_transaction(
  p_transaction_id uuid
)
returns table(transaction_id uuid, points_reverted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_user_id uuid;
  v_points integer;
begin
  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can delete transactions';
  end if;

  select wt.user_id, wt.points_awarded
  into v_user_id, v_points
  from public.waste_transactions wt
  where wt.id = p_transaction_id
  for update;

  if v_user_id is null then
    raise exception 'Transaction not found';
  end if;

  delete from public.waste_transactions
  where id = p_transaction_id;

  update public.profiles
  set points = points - v_points
  where id = v_user_id;

  return query select p_transaction_id, v_points;
end;
$$;

create table if not exists public.league_settings (
  id integer primary key default 1 check (id = 1),
  league_size integer not null default 20 check (league_size >= 5),
  promote_count integer not null default 3 check (promote_count >= 0),
  demote_count integer not null default 3 check (demote_count >= 0),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (promote_count + demote_count < league_size)
);

create table if not exists public.league_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by_admin_id uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (week_end > week_start)
);

create table if not exists public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.league_weeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_tier integer not null default 1 check (league_tier >= 1),
  weekly_points numeric(12,1) not null default 0,
  rank integer,
  created_at timestamptz not null default now(),
  unique (week_id, user_id)
);

create index if not exists idx_league_weeks_status_start on public.league_weeks(status, week_start desc);
drop index if exists public.idx_league_weeks_single_open;
create index if not exists idx_league_memberships_week_tier_rank on public.league_memberships(week_id, league_tier, rank);
create index if not exists idx_league_memberships_user on public.league_memberships(user_id);

insert into public.league_settings (id, league_size, promote_count, demote_count, enabled)
values (1, 20, 3, 3, true)
on conflict (id) do nothing;

alter table public.league_settings enable row level security;
alter table public.league_weeks enable row level security;
alter table public.league_memberships enable row level security;

drop policy if exists "league_settings_read_all" on public.league_settings;
create policy "league_settings_read_all"
on public.league_settings for select
using (auth.role() = 'authenticated');

drop policy if exists "league_settings_admin_write" on public.league_settings;
create policy "league_settings_admin_write"
on public.league_settings for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "league_weeks_read_all" on public.league_weeks;
create policy "league_weeks_read_all"
on public.league_weeks for select
using (auth.role() = 'authenticated');

drop policy if exists "league_weeks_admin_write" on public.league_weeks;
create policy "league_weeks_admin_write"
on public.league_weeks for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "league_memberships_admin_read" on public.league_memberships;
create policy "league_memberships_admin_read"
on public.league_memberships for select
using (public.current_profile_role() = 'admin');

drop policy if exists "league_memberships_admin_write" on public.league_memberships;
create policy "league_memberships_admin_write"
on public.league_memberships for all
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create or replace function public.league_tier_name(p_tier integer)
returns text
language sql
stable
as $$
  select case
    when coalesce(p_tier, 1) <= 1 then 'Bronze League'
    when p_tier = 2 then 'Silver League'
    when p_tier = 3 then 'Gold League'
    when p_tier = 4 then 'Platinum League'
    when p_tier = 5 then 'Diamond League'
    else 'Legend League ' || p_tier::text
  end;
$$;

create or replace function public.ensure_current_league_week()
returns table(week_id uuid, week_start date, week_end date, status text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_week_start date := date_trunc('week', timezone('utc', now()))::date;
  v_week_end date := (v_week_start + 7);
begin
  insert into public.league_weeks (week_start, week_end, status)
  values (v_week_start, v_week_end, 'open')
  on conflict (week_start) do nothing;

  update public.league_weeks lw
  set
    status = 'closed',
    closed_at = coalesce(lw.closed_at, now())
  where lw.status = 'open'
    and lw.week_start < v_week_start;

  return query
  select lw.id, lw.week_start, lw.week_end, lw.status
  from public.league_weeks lw
  where lw.week_start = v_week_start
  limit 1;
end;
$$;

create or replace function public.league_refresh_current_scores()
returns table(week_id uuid, week_start date, week_end date, participants integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_week_id uuid;
  v_week_start date;
  v_week_end date;
  v_prev_week_id uuid;
  v_league_size integer;
  v_promote_count integer;
  v_demote_count integer;
  v_enabled boolean;
begin
  insert into public.league_settings (id, league_size, promote_count, demote_count, enabled)
  values (1, 20, 3, 3, true)
  on conflict (id) do nothing;

  select ls.league_size, ls.promote_count, ls.demote_count, ls.enabled
  into v_league_size, v_promote_count, v_demote_count, v_enabled
  from public.league_settings ls
  where ls.id = 1;

  v_league_size := greatest(coalesce(v_league_size, 20), 5);
  v_promote_count := greatest(coalesce(v_promote_count, 3), 0);
  v_demote_count := greatest(coalesce(v_demote_count, 3), 0);

  select ew.week_id, ew.week_start, ew.week_end
  into v_week_id, v_week_start, v_week_end
  from public.ensure_current_league_week() ew
  limit 1;

  if v_week_id is null then
    raise exception 'Unable to initialize league week';
  end if;

  select lw.id
  into v_prev_week_id
  from public.league_weeks lw
  where lw.status = 'closed'
    and lw.week_end <= v_week_start
  order by lw.week_start desc
  limit 1;

  if not exists (select 1 from public.league_memberships lm where lm.week_id = v_week_id) then
    if v_prev_week_id is null then
      insert into public.league_memberships (week_id, user_id, league_tier, weekly_points)
      select v_week_id, p.id, 1, 0
      from public.profiles p
      where p.role = 'user'
        and coalesce(p.disabled, false) = false;
    else
      with prev_rows as (
        select
          lm.user_id,
          lm.league_tier,
          lm.rank,
          count(*) over (partition by lm.league_tier) as tier_population
        from public.league_memberships lm
        join public.profiles p
          on p.id = lm.user_id
        where lm.week_id = v_prev_week_id
          and p.role = 'user'
          and coalesce(p.disabled, false) = false
      ),
      moved as (
        select
          pr.user_id,
          case
            when v_promote_count > 0 and pr.rank is not null and pr.rank <= v_promote_count then pr.league_tier + 1
            when v_demote_count > 0 and pr.rank is not null and pr.rank > greatest(pr.tier_population - v_demote_count, 0)
              then greatest(1, pr.league_tier - 1)
            else pr.league_tier
          end as next_tier
        from prev_rows pr
      )
      insert into public.league_memberships (week_id, user_id, league_tier, weekly_points)
      select
        v_week_id,
        p.id,
        coalesce(m.next_tier, 1),
        0
      from public.profiles p
      left join moved m
        on m.user_id = p.id
      where p.role = 'user'
        and coalesce(p.disabled, false) = false;
    end if;
  end if;

  delete from public.league_memberships lm
  using public.profiles p
  where lm.week_id = v_week_id
    and lm.user_id = p.id
    and (p.role <> 'user' or coalesce(p.disabled, false) = true);

  insert into public.league_memberships (week_id, user_id, league_tier, weekly_points)
  select v_week_id, p.id, 1, 0
  from public.profiles p
  where p.role = 'user'
    and coalesce(p.disabled, false) = false
    and not exists (
      select 1
      from public.league_memberships lm
      where lm.week_id = v_week_id
        and lm.user_id = p.id
    );

  with ordered as (
    select
      lm.id,
      lm.league_tier,
      row_number() over (partition by lm.league_tier order by lm.user_id) as tier_pos
    from public.league_memberships lm
    where lm.week_id = v_week_id
  ),
  balanced as (
    select
      o.id,
      (o.league_tier + ((o.tier_pos - 1) / v_league_size))::integer as new_tier
    from ordered o
  )
  update public.league_memberships lm
  set league_tier = b.new_tier
  from balanced b
  where lm.id = b.id
    and lm.league_tier <> b.new_tier;

  if not coalesce(v_enabled, true) then
    update public.league_memberships
    set weekly_points = 0, rank = null
    where week_id = v_week_id;

    return query
    select
      v_week_id,
      v_week_start,
      v_week_end,
      coalesce((select count(*) from public.league_memberships lm where lm.week_id = v_week_id), 0)::integer;
    return;
  end if;

  with waste_points as (
    select
      wt.user_id,
      sum(wt.points_awarded)::numeric(12,1) as points
    from public.waste_transactions wt
    where wt.created_at >= v_week_start::timestamptz
      and wt.created_at < v_week_end::timestamptz
    group by wt.user_id
  ),
  incoming_points as (
    select
      pt.to_id as user_id,
      sum(pt.points)::numeric(12,1) as points
    from public.point_transfers pt
    join public.profiles p_to
      on p_to.id = pt.to_id
    where p_to.role = 'user'
      and pt.created_at >= v_week_start::timestamptz
      and pt.created_at < v_week_end::timestamptz
    group by pt.to_id
  ),
  total_points as (
    select
      p.id as user_id,
      (coalesce(w.points, 0) + coalesce(i.points, 0))::numeric(12,1) as weekly_points
    from public.profiles p
    left join waste_points w
      on w.user_id = p.id
    left join incoming_points i
      on i.user_id = p.id
    where p.role = 'user'
      and coalesce(p.disabled, false) = false
  )
  update public.league_memberships lm
  set weekly_points = coalesce(tp.weekly_points, 0)
  from total_points tp
  where lm.week_id = v_week_id
    and lm.user_id = tp.user_id;

  with ranked as (
    select
      lm.id,
      row_number() over (
        partition by lm.league_tier
        order by lm.weekly_points desc, p.created_at asc, lm.user_id
      ) as new_rank
    from public.league_memberships lm
    join public.profiles p
      on p.id = lm.user_id
    where lm.week_id = v_week_id
  )
  update public.league_memberships lm
  set rank = ranked.new_rank
  from ranked
  where lm.id = ranked.id;

  return query
  select
    v_week_id,
    v_week_start,
    v_week_end,
    coalesce((select count(*) from public.league_memberships lm where lm.week_id = v_week_id), 0)::integer;
end;
$$;

create or replace function public.admin_update_league_settings(
  p_league_size integer,
  p_promote_count integer,
  p_demote_count integer,
  p_enabled boolean default true
)
returns table(
  league_size integer,
  promote_count integer,
  demote_count integer,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
begin
  if v_admin_id is null then
    raise exception 'Not authenticated';
  end if;

  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can update league settings';
  end if;

  if p_league_size is null or p_league_size < 5 then
    raise exception 'League size must be >= 5';
  end if;

  if p_promote_count is null or p_promote_count < 0 then
    raise exception 'Promote count must be >= 0';
  end if;

  if p_demote_count is null or p_demote_count < 0 then
    raise exception 'Demote count must be >= 0';
  end if;

  if p_promote_count + p_demote_count >= p_league_size then
    raise exception 'Promote + demote must be less than league size';
  end if;

  insert into public.league_settings (
    id,
    league_size,
    promote_count,
    demote_count,
    enabled,
    updated_by,
    updated_at
  )
  values (
    1,
    p_league_size,
    p_promote_count,
    p_demote_count,
    coalesce(p_enabled, true),
    v_admin_id,
    now()
  )
  on conflict (id) do update
  set
    league_size = excluded.league_size,
    promote_count = excluded.promote_count,
    demote_count = excluded.demote_count,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  perform public.league_refresh_current_scores();

  return query
  select
    ls.league_size,
    ls.promote_count,
    ls.demote_count,
    ls.enabled,
    ls.updated_at
  from public.league_settings ls
  where ls.id = 1;
end;
$$;

create or replace function public.admin_close_league_week(
  p_start_next_week boolean default true
)
returns table(
  closed_week_id uuid,
  closed_week_start date,
  closed_week_end date,
  next_week_start date,
  next_week_end date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
  v_open public.league_weeks%rowtype;
  v_next_start date;
  v_next_end date;
begin
  if v_admin_id is null then
    raise exception 'Not authenticated';
  end if;

  select pr.role into v_admin_role
  from public.profiles pr
  where pr.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can close league week';
  end if;

  perform public.league_refresh_current_scores();

  select lw.*
  into v_open
  from public.league_weeks lw
  where lw.status = 'open'
  order by lw.week_start desc
  limit 1
  for update;

  if v_open.id is null then
    raise exception 'No open league week found';
  end if;

  update public.league_weeks
  set
    status = 'closed',
    closed_by_admin_id = v_admin_id,
    closed_at = now()
  where id = v_open.id;

  if coalesce(p_start_next_week, true) then
    v_next_start := v_open.week_end;
    v_next_end := (v_next_start + 7);

    insert into public.league_weeks (week_start, week_end, status)
    values (v_next_start, v_next_end, 'open')
    on conflict (week_start) do update
    set
      week_end = excluded.week_end,
      status = 'open',
      closed_by_admin_id = null,
      closed_at = null;
  end if;

  perform public.league_refresh_current_scores();

  return query
  select
    v_open.id,
    v_open.week_start,
    v_open.week_end,
    v_next_start,
    v_next_end;
end;
$$;

create or replace function public.get_user_league_snapshot()
returns table(
  week_start date,
  week_end date,
  league_tier integer,
  league_name text,
  profile_id uuid,
  profile_name text,
  weekly_points numeric,
  rank integer,
  is_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_week_id uuid;
  v_tier integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = v_user_id;

  if v_user_role <> 'user' then
    raise exception 'Only users can view league snapshot';
  end if;

  perform public.league_refresh_current_scores();

  select lm.week_id, lm.league_tier
  into v_week_id, v_tier
  from public.league_memberships lm
  join public.league_weeks lw
    on lw.id = lm.week_id
  where lw.status = 'open'
    and lm.user_id = v_user_id
  order by lw.week_start desc
  limit 1;

  if v_week_id is null then
    return;
  end if;

  return query
  select
    lw.week_start,
    lw.week_end,
    lm.league_tier,
    public.league_tier_name(lm.league_tier),
    lm.user_id,
    coalesce(p.name, p.phone, 'User'),
    lm.weekly_points,
    lm.rank,
    (lm.user_id = v_user_id) as is_me
  from public.league_memberships lm
  join public.league_weeks lw
    on lw.id = lm.week_id
  join public.profiles p
    on p.id = lm.user_id
  where lm.week_id = v_week_id
    and lm.league_tier = v_tier
  order by lm.rank asc nulls last, lm.weekly_points desc, p.created_at asc;
end;
$$;

create or replace function public.admin_get_league_week_rows()
returns table(
  week_id uuid,
  week_start date,
  week_end date,
  league_tier integer,
  league_name text,
  profile_id uuid,
  profile_name text,
  profile_phone text,
  weekly_points numeric,
  rank integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin_id uuid := auth.uid();
  v_admin_role text;
begin
  if v_admin_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.role into v_admin_role
  from public.profiles p
  where p.id = v_admin_id;

  if v_admin_role <> 'admin' then
    raise exception 'Only admin can view league table';
  end if;

  perform public.league_refresh_current_scores();

  return query
  select
    lw.id,
    lw.week_start,
    lw.week_end,
    lm.league_tier,
    public.league_tier_name(lm.league_tier),
    lm.user_id,
    coalesce(p.name, p.phone, 'User'),
    p.phone,
    lm.weekly_points,
    lm.rank
  from public.league_memberships lm
  join public.league_weeks lw
    on lw.id = lm.week_id
  join public.profiles p
    on p.id = lm.user_id
  where lw.status = 'open'
  order by lm.league_tier asc, lm.rank asc nulls last, lm.weekly_points desc, p.created_at asc;
end;
$$;

drop function if exists public.admin_upsert_store_profile(text, text, text, text, boolean);
drop function if exists public.admin_upsert_store_profile(text, text, text, text, boolean, text);
grant execute on function public.admin_upsert_store_profile(text, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.admin_adjust_waste_transaction(uuid, numeric, integer) to authenticated;
grant execute on function public.admin_delete_waste_transaction(uuid) to authenticated;
grant execute on function public.admin_delete_store_profile(uuid) to authenticated;
grant execute on function public.admin_set_cash_rates(numeric, numeric) to authenticated;
grant execute on function public.admin_settle_profile_points(uuid, text) to authenticated;
grant execute on function public.league_tier_name(integer) to authenticated;
grant execute on function public.ensure_current_league_week() to authenticated;
grant execute on function public.league_refresh_current_scores() to authenticated;
grant execute on function public.admin_update_league_settings(integer, integer, integer, boolean) to authenticated;
grant execute on function public.admin_close_league_week(boolean) to authenticated;
grant execute on function public.get_user_league_snapshot() to authenticated;
grant execute on function public.admin_get_league_week_rows() to authenticated;
