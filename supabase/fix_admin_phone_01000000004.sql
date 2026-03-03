-- Fix old admin phone account to be admin.
-- Target admin phone: 01000000004
--
-- Run in Supabase SQL editor, then logout/login.

insert into public.profiles (id, name, phone, role, points, store_name, disabled)
select
  u.id,
  'System Admin',
  '01000000004',
  'admin',
  0,
  null,
  false
from auth.users u
where lower(u.email) = lower('01000000004@nuqta.app')
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  points = excluded.points,
  store_name = excluded.store_name,
  disabled = excluded.disabled;

-- Optional check:
-- select id, name, phone, role from public.profiles where phone = '01000000004';
