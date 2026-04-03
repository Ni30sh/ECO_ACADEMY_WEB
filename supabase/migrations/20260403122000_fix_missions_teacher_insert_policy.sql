-- Allow teachers and admins to create/update missions using the current role model.
-- The app stores roles in public.profiles and also mirrors them in JWT metadata.

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('teacher', 'admin', 'school_admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, '') IN ('teacher', 'admin', 'school_admin')
    );
$$;

DROP POLICY IF EXISTS missions_teacher_admin_access ON public.missions;
CREATE POLICY missions_teacher_admin_insert ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_teacher_or_admin_user()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS missions_teacher_admin_update ON public.missions;
CREATE POLICY missions_teacher_admin_update ON public.missions
  FOR UPDATE TO authenticated
  USING (
    public.is_teacher_or_admin_user()
    AND (created_by = auth.uid() OR public.is_admin_user())
  )
  WITH CHECK (
    public.is_teacher_or_admin_user()
    AND (created_by = auth.uid() OR public.is_admin_user())
  );