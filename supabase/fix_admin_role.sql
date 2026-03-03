-- Fix one account to be admin by phone number.
-- Run in Supabase SQL editor.
--
-- 1) Replace ADMIN_PHONE in both places below.
-- 2) Execute script.
-- 3) Logout/login in app.

with target_user as (
  select id
  from auth.users
  where lower(email) = lower('ADMIN_PHONE@nuqta.app')
  limit 1
)
insert into public.profiles (id, name, phone, role, points, store_name, disabled)
select
  tu.id,
  'System Admin',
  'ADMIN_PHONE',
  'admin',
  0,
  null,
  false
from target_user tu
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  points = excluded.points,
  store_name = excluded.store_name,
  disabled = excluded.disabled;

-- Optional check:
-- select id, name, phone, role from public.profiles where phone = 'ADMIN_PHONE';
