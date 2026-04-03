-- Admin elevation policies: grant administrator broad access across educator workflows.
-- These are additive, permissive policies and do not remove existing own-scope policies.

-- Helper function to resolve administrator role safely in RLS policies.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.role, '') = 'admin'
    );
$$;

-- Profiles
DROP POLICY IF EXISTS profiles_admin_full_access ON public.profiles;
CREATE POLICY profiles_admin_full_access ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Missions
DROP POLICY IF EXISTS missions_admin_full_access ON public.missions;
CREATE POLICY missions_admin_full_access ON public.missions
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Mission submissions
DROP POLICY IF EXISTS mission_submissions_admin_full_access ON public.mission_submissions;
CREATE POLICY mission_submissions_admin_full_access ON public.mission_submissions
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Mission step submissions
DROP POLICY IF EXISTS mission_step_submissions_admin_full_access ON public.mission_step_submissions;
CREATE POLICY mission_step_submissions_admin_full_access ON public.mission_step_submissions
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Lessons and progress
DROP POLICY IF EXISTS lessons_admin_full_access ON public.lessons;
CREATE POLICY lessons_admin_full_access ON public.lessons
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS lesson_completions_admin_full_access ON public.lesson_completions;
CREATE POLICY lesson_completions_admin_full_access ON public.lesson_completions
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS quiz_attempts_admin_full_access ON public.quiz_attempts;
CREATE POLICY quiz_attempts_admin_full_access ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Badges and rewards
DROP POLICY IF EXISTS badges_admin_full_access ON public.badges;
CREATE POLICY badges_admin_full_access ON public.badges
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS user_badges_admin_full_access ON public.user_badges;
CREATE POLICY user_badges_admin_full_access ON public.user_badges
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Notifications and analytics
DROP POLICY IF EXISTS notifications_admin_full_access ON public.notifications;
CREATE POLICY notifications_admin_full_access ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS daily_points_admin_full_access ON public.daily_points;
CREATE POLICY daily_points_admin_full_access ON public.daily_points
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
