-- Create teacher/admin notifications when a mission submission enters pending review.
-- This runs server-side so student/mobile clients do not need direct notification insert permissions.

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
      reviewer.role IN ('admin', 'school_admin')
      OR reviewer.school_id IS NULL
      OR reviewer.school_id IS NOT DISTINCT FROM (
        SELECT student_profile.school_id
        FROM public.profiles student_profile
        WHERE student_profile.id = NEW.user_id
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reviewers_on_pending_submission ON public.mission_submissions;
CREATE TRIGGER trg_notify_reviewers_on_pending_submission
AFTER INSERT OR UPDATE OF status, reviewed_at ON public.mission_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_reviewers_on_pending_submission();
