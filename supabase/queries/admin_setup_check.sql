-- One-click admin setup for admin1@gmail.com
-- Paste this into Supabase SQL Editor and run once.

BEGIN;

WITH params AS (
  SELECT lower('admin1@gmail.com') AS target_email
),
auth_row AS (
  SELECT
    u.id,
    COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)) AS full_name
  FROM auth.users u
  JOIN params p ON lower(u.email) = p.target_email
)
INSERT INTO public.profiles (
  id,
  full_name,
  role,
  avatar_emoji,
  eco_points,
  streak_days,
  daily_goal,
  interests,
  created_at,
  updated_at
)
SELECT
  a.id,
  a.full_name,
  'admin',
  '🌱',
  0,
  0,
  2,
  '{}'::text[],
  NOW(),
  NOW()
FROM auth_row a
ON CONFLICT (id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = 'admin',
  avatar_emoji = COALESCE(public.profiles.avatar_emoji, '🌱'),
  updated_at = NOW();

WITH params AS (
  SELECT lower('admin1@gmail.com') AS target_email
)
UPDATE auth.users u
SET
  raw_user_meta_data = jsonb_set(COALESCE(u.raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"'::jsonb, true),
  raw_app_meta_data = jsonb_set(COALESCE(u.raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'::jsonb, true)
FROM params p
WHERE lower(u.email) = p.target_email;

COMMIT;

-- Verify result
WITH params AS (
  SELECT lower('admin1@gmail.com') AS target_email
)
SELECT
  lower(u.email) AS email,
  p.id,
  p.full_name,
  p.role,
  u.raw_user_meta_data->>'role' AS auth_metadata_role,
  u.raw_app_meta_data->>'role' AS app_metadata_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
JOIN params prm ON lower(u.email) = prm.target_email;
