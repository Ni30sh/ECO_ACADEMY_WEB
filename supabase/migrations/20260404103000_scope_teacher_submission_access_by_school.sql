-- Enforce school-scoped teacher access for mission submissions.
-- Teachers and school_admin users can only read/update submissions from students in the same school.
-- Admin users keep full access via mission_submissions_admin_full_access.

CREATE OR REPLACE FUNCTION public.can_access_student_in_same_school_for_actor(actor_user_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor
    JOIN public.profiles target ON target.id = target_user_id
    LEFT JOIN public.schools actor_school ON actor_school.id = actor.school_id
    LEFT JOIN public.schools target_school ON target_school.id = target.school_id
    WHERE actor.id = actor_user_id
      AND COALESCE(actor.role, '') IN ('teacher', 'school_admin')
      AND COALESCE(target.role, '') = 'student'
      AND (
        (
          actor.school_id IS NOT NULL
          AND target.school_id IS NOT NULL
          AND actor.school_id IS NOT DISTINCT FROM target.school_id
        )
        OR (
          COALESCE(LOWER(actor_school.name), '') <> ''
          AND COALESCE(LOWER(target_school.name), '') <> ''
          AND LOWER(actor_school.name) = LOWER(target_school.name)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_student_in_same_school(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_student_in_same_school_for_actor(auth.uid(), target_user_id);
$$;

-- Keep the existing shared helper aligned with strict same-school scope.
-- This helper is reused by profile/daily_points/notification RLS policies.
CREATE OR REPLACE FUNCTION public.is_teacher_for_same_school(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_student_in_same_school_for_actor(auth.uid(), target_user_id);
$$;

DROP POLICY IF EXISTS "Teachers can view all submissions" ON public.mission_submissions;
DROP POLICY IF EXISTS "Teachers can update all submissions" ON public.mission_submissions;
DROP POLICY IF EXISTS mission_submissions_select_own ON public.mission_submissions;
DROP POLICY IF EXISTS mission_submissions_update_own ON public.mission_submissions;
DROP POLICY IF EXISTS mission_submissions_teacher_admin_access ON public.mission_submissions;
DROP POLICY IF EXISTS mission_submissions_teacher_admin_update ON public.mission_submissions;

CREATE POLICY mission_submissions_select_own ON public.mission_submissions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_user()
    OR public.can_access_student_in_same_school(user_id)
  );

CREATE POLICY mission_submissions_update_own ON public.mission_submissions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_user()
    OR public.can_access_student_in_same_school(user_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_user()
    OR public.can_access_student_in_same_school(user_id)
  );

-- Keep reviewer notifications school-scoped for teacher/school_admin users.
-- Admins continue receiving all pending-review alerts.
CREATE OR REPLACE FUNCTION public.notify_reviewers_on_pending_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_title text;
  student_name text;
BEGIN
  IF NEW.status <> 'pending' OR NEW.reviewed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND OLD.reviewed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.title INTO mission_title
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  SELECT p.full_name INTO student_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, is_read)
  SELECT
    reviewer.id,
    'New mission submission ready for review',
    COALESCE(student_name, 'A student') || ' submitted ' || COALESCE(mission_title, 'a mission') || ' for review.',
    'mission',
    false
  FROM public.profiles reviewer
  WHERE COALESCE(reviewer.role, '') IN ('teacher', 'admin', 'school_admin')
    AND (
      COALESCE(reviewer.role, '') = 'admin'
      OR (
        COALESCE(reviewer.role, '') IN ('teacher', 'school_admin')
        AND public.can_access_student_in_same_school_for_actor(reviewer.id, NEW.user_id)
      )
    );

  RETURN NEW;
END;
$$;
