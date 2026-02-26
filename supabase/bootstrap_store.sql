-- Create or promote an existing auth user to a verified store profile.
-- Update PHONE / ROLE / STORE_NAME before running.

-- Example roles: 'collector_store' or 'partner_store'
-- Example email format used by app: PHONE@nuqta.app

insert into public.profiles (id, name, phone, role, points, store_name, disabled)
select
  u.id,
  'Store Owner',
  '01000000002',
  'collector_store',
  0,
  'Green Store',
  false
from auth.users u
where lower(u.email) = lower('01000000002@nuqta.app')
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  points = excluded.points,
  store_name = excluded.store_name,
  disabled = excluded.disabled;
