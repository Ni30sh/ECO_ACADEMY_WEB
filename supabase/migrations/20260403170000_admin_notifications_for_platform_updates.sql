-- Notify admins/school_admins for key platform updates beyond pending submissions.

CREATE OR REPLACE FUNCTION public.notify_all_admin_users(
  p_title text,
  p_body text,
  p_type text DEFAULT 'admin_update'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, is_read)
  SELECT p.id, p_title, p_body, p_type, false
  FROM public.profiles p
  WHERE COALESCE(p.role::text, '') IN ('admin', 'school_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_submission_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_title text;
  student_name text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT m.title INTO mission_title
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  SELECT p.full_name INTO student_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  PERFORM public.notify_all_admin_users(
    'Submission review update',
    COALESCE(student_name, 'A student') ||
      ' submission for ' || COALESCE(mission_title, 'a mission') ||
      ' was marked ' || NEW.status || '.',
    'mission_feedback'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_all_admin_users(
    'User role changed',
    COALESCE(NEW.full_name, 'A user') ||
      ' role changed from ' || COALESCE(OLD.role::text, 'unknown') ||
      ' to ' || COALESCE(NEW.role::text, 'unknown') || '.',
    'role_approval'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_mission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_name text;
  action_name text;
BEGIN
  mission_name := COALESCE(NEW.title, OLD.title, 'a mission');
  action_name := lower(TG_OP);

  PERFORM public.notify_all_admin_users(
    'Mission ' || action_name,
    'Mission "' || mission_name || '" was ' || action_name || '.',
    'mission'
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_submission_review ON public.mission_submissions;
CREATE TRIGGER trg_notify_admins_on_submission_review
AFTER UPDATE OF status ON public.mission_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_submission_review();

DROP TRIGGER IF EXISTS trg_notify_admins_on_role_change ON public.profiles;
CREATE TRIGGER trg_notify_admins_on_role_change
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_role_change();

DROP TRIGGER IF EXISTS trg_notify_admins_on_mission_change ON public.missions;
CREATE TRIGGER trg_notify_admins_on_mission_change
AFTER INSERT OR UPDATE OR DELETE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_mission_change();
