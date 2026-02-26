-- Run this file once in Supabase SQL editor to enable admin store + transaction management.

create or replace function public.admin_upsert_store_profile(
  p_phone text,
  p_name text,
  p_store_name text,
  p_role text,
  p_disabled boolean default false
)
returns table(profile_id uuid, role text, store_name text)
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

  insert into public.profiles (id, name, phone, role, points, store_name, disabled)
  values (v_user_id, trim(p_name), v_phone, p_role, 0, trim(p_store_name), coalesce(p_disabled, false))
  on conflict (id) do update
  set
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    store_name = excluded.store_name,
    disabled = excluded.disabled;

  return query
  select p.id, p.role, p.store_name
  from public.profiles p
  where p.id = v_user_id;
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

grant execute on function public.admin_upsert_store_profile(text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_adjust_waste_transaction(uuid, numeric, integer) to authenticated;
grant execute on function public.admin_delete_waste_transaction(uuid) to authenticated;
