-- Run this file once in Supabase SQL editor to enable admin store + transaction management.

alter table public.profiles add column if not exists photo_url text;

-- Some projects already have custom/legacy policies referencing profiles.points.
-- Drop those policies before changing column type.
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

-- RLS policy depends on profiles.points type, so drop/recreate it around type migration.
drop policy if exists "profiles_self_insert_signup" on public.profiles;
drop policy if exists "profiles_self_insert_user" on public.profiles;

alter table public.profiles
  alter column points type numeric(12,1)
  using round(points::numeric, 1),
  alter column points set default 0;

alter table public.point_transfers
  alter column points type numeric(12,1)
  using round(points::numeric, 1);

create policy "profiles_self_insert_signup"
on public.profiles for insert
with check (
  auth.uid() = id
  and role = 'user'
  and (store_name is null or store_name = '')
  and points = 0
);

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

  v_points := round(p_points::numeric, 1);
  if p_points::numeric <> v_points then
    raise exception 'Points must use 0.1 steps only (example: 0.1, 1.5)';
  end if;

  if p_to_id = v_from_id then
    raise exception 'Cannot transfer to self';
  end if;

  select role, points into v_from_role, v_from_points
  from public.profiles
  where id = v_from_id
  for update;

  if v_from_role <> 'user' then
    raise exception 'Only users can transfer points';
  end if;

  if v_from_points < v_points then
    raise exception 'Insufficient points';
  end if;

  select role into v_to_role
  from public.profiles
  where id = p_to_id
  for update;

  if v_to_role is null then
    raise exception 'Recipient not found';
  end if;

  if p_transfer_type = 'user_to_user' and v_to_role <> 'user' then
    raise exception 'Recipient must be user';
  end if;

  if p_transfer_type = 'user_to_store' and v_to_role <> 'partner_store' then
    raise exception 'Recipient must be partner store';
  end if;

  if p_transfer_type not in ('user_to_user','user_to_store') then
    raise exception 'Invalid transfer type';
  end if;

  update public.profiles set points = points - v_points where id = v_from_id;
  update public.profiles set points = points + v_points where id = p_to_id;

  insert into public.point_transfers (from_id, to_id, points, transfer_type, note)
  values (v_from_id, p_to_id, v_points, p_transfer_type, p_note)
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

create or replace function public.admin_upsert_store_profile(
  p_phone text,
  p_name text,
  p_store_name text,
  p_role text,
  p_disabled boolean default false,
  p_photo_url text default null
)
returns table(profile_id uuid, role text, store_name text, photo_url text)
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

  v_email := lower(v_phone || '@nuqta.app');

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'No auth account found for this phone. Ask the store owner to register first.';
  end if;

  insert into public.profiles (id, name, phone, role, points, store_name, photo_url, disabled)
  values (v_user_id, trim(p_name), v_phone, p_role, 0, trim(p_store_name), nullif(trim(coalesce(p_photo_url, '')), ''), coalesce(p_disabled, false))
  on conflict (id) do update
  set
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    store_name = excluded.store_name,
    photo_url = excluded.photo_url,
    disabled = excluded.disabled;

  return query
  select p.id, p.role, p.store_name, p.photo_url
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

drop function if exists public.admin_upsert_store_profile(text, text, text, text, boolean);
drop function if exists public.transfer_points(uuid, integer, text, text);
grant execute on function public.admin_upsert_store_profile(text, text, text, text, boolean, text) to authenticated;
grant execute on function public.transfer_points(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_adjust_waste_transaction(uuid, numeric, integer) to authenticated;
grant execute on function public.admin_delete_waste_transaction(uuid) to authenticated;
grant execute on function public.admin_delete_store_profile(uuid) to authenticated;
