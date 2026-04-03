-- Allow teacher/admin web workflows to award student eco points safely.
-- Teachers can update student profiles only within their own school scope.

CREATE OR REPLACE FUNCTION public.is_teacher_for_same_school(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles teacher_profile
    JOIN public.profiles target_profile ON target_profile.id = target_user_id
    LEFT JOIN public.schools teacher_school ON teacher_school.id = teacher_profile.school_id
    LEFT JOIN public.schools target_school ON target_school.id = target_profile.school_id
    WHERE teacher_profile.id = auth.uid()
      AND public.is_teacher_or_admin_user()
      AND COALESCE(target_profile.role, '') = 'student'
      AND (
        teacher_profile.school_id IS NULL
        OR target_profile.school_id IS NULL
        OR teacher_profile.school_id IS NOT DISTINCT FROM target_profile.school_id
        OR (
          COALESCE(LOWER(teacher_school.name), '') <> ''
          AND LOWER(teacher_school.name) = LOWER(target_school.name)
        )
      )
  );
$$;

DROP POLICY IF EXISTS profiles_teacher_admin_update_students_same_school ON public.profiles;
CREATE POLICY profiles_teacher_admin_update_students_same_school ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.is_teacher_or_admin_user()
      AND COALESCE(role, '') = 'student'
      AND public.is_teacher_for_same_school(public.profiles.id)
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.is_teacher_or_admin_user()
      AND COALESCE(role, '') = 'student'
      AND public.is_teacher_for_same_school(public.profiles.id)
    )
  );

DROP POLICY IF EXISTS daily_points_teacher_admin_manage_same_school ON public.daily_points;
CREATE POLICY daily_points_teacher_admin_manage_same_school ON public.daily_points
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.is_teacher_or_admin_user()
      AND public.is_teacher_for_same_school(public.daily_points.user_id)
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.is_teacher_or_admin_user()
      AND public.is_teacher_for_same_school(public.daily_points.user_id)
    )
  );

DROP POLICY IF EXISTS notifications_teacher_admin_insert_same_school ON public.notifications;
CREATE POLICY notifications_teacher_admin_insert_same_school ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.is_teacher_or_admin_user()
      AND public.is_teacher_for_same_school(public.notifications.user_id)
    )
  );
