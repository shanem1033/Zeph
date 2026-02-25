-- Seed demo airline accounts
-- Each airline has an ops@ email matching its domain.
-- Password for all: <airline>123  (e.g. ryanair123, easyjet123)
--
-- This uses Supabase's auth.users table directly.
-- In production, airline accounts would be provisioned via an admin process.

-- Ryanair  (IATA: FR)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@ryanair.com', crypt('ryanair123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;

-- EasyJet  (IATA: U2)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@easyjet.com', crypt('easyjet123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;

-- Lufthansa  (IATA: LH)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@lufthansa.com', crypt('lufthansa123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;

-- Air France  (IATA: AF)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@airfrance.com', crypt('airfrance123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;

-- Iberia  (IATA: IB)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@iberia.com', crypt('iberia123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;

-- British Airways  (IATA: BA)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'ops@britishairways.com', crypt('britishairways123', gen_salt('bf')), now(),
  '{"role": "airline"}'::jsonb, 'authenticated', 'authenticated', now(), now()
) ON CONFLICT (email) DO NOTHING;
