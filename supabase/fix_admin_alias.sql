-- Ensure "Admin" username login works.
-- App maps username "Admin" -> auth email: admin@nuqta.app
--
-- Steps:
-- 1) In Supabase Dashboard > Authentication > Users:
--    create (or edit) user with email admin@nuqta.app and set password to: 191997
-- 2) Run this SQL to ensure profile role is admin.

insert into public.profiles (id, name, phone, role, points, store_name, disabled)
select
  u.id,
  'System Admin',
  'admin',
  'admin',
  0,
  null,
  false
from auth.users u
where lower(u.email) = lower('admin@nuqta.app')
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  points = excluded.points,
  store_name = excluded.store_name,
  disabled = excluded.disabled;
