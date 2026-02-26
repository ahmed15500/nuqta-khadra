-- ============================================================
-- Unified CSV import bridge for all related tables
-- Targets:
--   public.profiles
--   public.waste_transactions
--   public.point_transfers
-- Depends on:
--   auth.users (for profile id mapping)
--   public.waste_types (for waste type mapping)
-- ============================================================

-- ------------------------------------------------------------
-- A) Staging tables (import CSVs into these from Table Editor)
-- ------------------------------------------------------------

create table if not exists public.profile_seed_import (
  email text not null,
  phone text not null,
  name text not null,
  role text not null,
  store_name text,
  points integer
);

create table if not exists public.waste_tx_seed_import (
  collector_phone text not null,
  user_phone text not null,
  waste_type_name text not null,
  weight_kg numeric(10,2) not null,
  points_awarded integer,
  created_at timestamptz
);

create table if not exists public.point_transfer_seed_import (
  from_phone text not null,
  to_phone text not null,
  points integer not null,
  transfer_type text not null,
  note text,
  created_at timestamptz
);

-- ------------------------------------------------------------
-- B) Upsert profiles (maps by auth.users.email -> profiles.id)
-- ------------------------------------------------------------

insert into public.profiles (id, name, phone, role, store_name, points, disabled)
select
  u.id,
  s.name,
  s.phone,
  s.role,
  nullif(s.store_name, ''),
  coalesce(s.points, 0),
  false
from public.profile_seed_import s
join auth.users u
  on lower(u.email) = lower(s.email)
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  store_name = excluded.store_name,
  points = excluded.points;

-- check rows that failed to map to auth.users
select s.*
from public.profile_seed_import s
left join auth.users u on lower(u.email) = lower(s.email)
where u.id is null;

-- ------------------------------------------------------------
-- C) Insert waste transactions from phone/name references
--    collector_phone -> profiles.id (collector_store)
--    user_phone      -> profiles.id (user)
--    waste_type_name -> waste_types.id
-- ------------------------------------------------------------

insert into public.waste_transactions (
  collector_store_id,
  user_id,
  waste_type_id,
  weight_kg,
  points_awarded,
  created_at
)
select
  pc.id as collector_store_id,
  pu.id as user_id,
  wt.id as waste_type_id,
  s.weight_kg,
  coalesce(s.points_awarded, round(s.weight_kg * wt.points_per_kg)::int) as points_awarded,
  coalesce(s.created_at, now()) as created_at
from public.waste_tx_seed_import s
join public.profiles pc
  on pc.phone = s.collector_phone and pc.role = 'collector_store'
join public.profiles pu
  on pu.phone = s.user_phone and pu.role = 'user'
join public.waste_types wt
  on wt.name = s.waste_type_name
where not exists (
  select 1
  from public.waste_transactions x
  where x.collector_store_id = pc.id
    and x.user_id = pu.id
    and x.waste_type_id = wt.id
    and x.weight_kg = s.weight_kg
    and x.points_awarded = coalesce(s.points_awarded, round(s.weight_kg * wt.points_per_kg)::int)
    and x.created_at = coalesce(s.created_at, now())
);

-- check unresolved waste transaction rows
select s.*
from public.waste_tx_seed_import s
left join public.profiles pc on pc.phone = s.collector_phone and pc.role = 'collector_store'
left join public.profiles pu on pu.phone = s.user_phone and pu.role = 'user'
left join public.waste_types wt on wt.name = s.waste_type_name
where pc.id is null or pu.id is null or wt.id is null;

-- ------------------------------------------------------------
-- D) Insert point transfers from phone references
--    from_phone/to_phone -> profiles.id
-- ------------------------------------------------------------

insert into public.point_transfers (
  from_id,
  to_id,
  points,
  transfer_type,
  note,
  created_at
)
select
  pf.id as from_id,
  pt.id as to_id,
  s.points,
  s.transfer_type,
  s.note,
  coalesce(s.created_at, now()) as created_at
from public.point_transfer_seed_import s
join public.profiles pf on pf.phone = s.from_phone
join public.profiles pt on pt.phone = s.to_phone
where s.transfer_type in ('user_to_user', 'user_to_store')
  and not exists (
    select 1
    from public.point_transfers x
    where x.from_id = pf.id
      and x.to_id = pt.id
      and x.points = s.points
      and x.transfer_type = s.transfer_type
      and coalesce(x.note, '') = coalesce(s.note, '')
      and x.created_at = coalesce(s.created_at, now())
  );

-- check unresolved transfer rows
select s.*
from public.point_transfer_seed_import s
left join public.profiles pf on pf.phone = s.from_phone
left join public.profiles pt on pt.phone = s.to_phone
where pf.id is null
   or pt.id is null
   or s.transfer_type not in ('user_to_user', 'user_to_store');

-- ------------------------------------------------------------
-- E) Optional: recompute profile points from transactions/transfers
--    Use this if you imported historical rows and want exact balances.
-- ------------------------------------------------------------

-- update public.profiles p
-- set points = coalesce(calc.points, 0)
-- from (
--   select x.id,
--          coalesce(w.in_points, 0)
--          + coalesce(r.in_points, 0)
--          - coalesce(s.out_points, 0) as points
--   from public.profiles x
--   left join (
--     select user_id, sum(points_awarded)::int as in_points
--     from public.waste_transactions
--     group by user_id
--   ) w on w.user_id = x.id
--   left join (
--     select to_id, sum(points)::int as in_points
--     from public.point_transfers
--     group by to_id
--   ) r on r.to_id = x.id
--   left join (
--     select from_id, sum(points)::int as out_points
--     from public.point_transfers
--     group by from_id
--   ) s on s.from_id = x.id
-- ) calc
-- where calc.id = p.id;

-- ------------------------------------------------------------
-- F) Optional cleanup (uncomment if needed)
-- ------------------------------------------------------------

-- truncate table public.profile_seed_import;
-- truncate table public.waste_tx_seed_import;
-- truncate table public.point_transfer_seed_import;
