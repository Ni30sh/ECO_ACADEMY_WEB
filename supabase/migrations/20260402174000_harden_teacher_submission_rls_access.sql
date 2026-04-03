-- Ensure teachers/admins can always read/update mission submissions for review,
-- regardless of whether role is sourced from profiles, user_roles, or JWT metadata.

DROP POLICY IF EXISTS mission_submissions_teacher_admin_access ON public.mission_submissions;
CREATE POLICY mission_submissions_teacher_admin_access ON public.mission_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, '') IN ('teacher', 'admin', 'school_admin')
    )
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
  );

DROP POLICY IF EXISTS mission_submissions_teacher_admin_update ON public.mission_submissions;
CREATE POLICY mission_submissions_teacher_admin_update ON public.mission_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, '') IN ('teacher', 'admin', 'school_admin')
    )
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
  );
