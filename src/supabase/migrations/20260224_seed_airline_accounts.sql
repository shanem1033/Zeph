-- Seed demo airline account for Ryanair
-- Email: ops@ryanair.com  Password: ryanair123
--
-- This uses Supabase's auth.users table directly.
-- The password hash below is bcrypt for 'ryanair123'.
-- In production, airline accounts would be provisioned via an admin process.

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  role,
  aud,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'ops@ryanair.com',
  crypt('ryanair123', gen_salt('bf')),
  now(),
  '{"role": "airline"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;
