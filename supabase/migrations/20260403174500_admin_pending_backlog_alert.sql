-- Smart admin alert rule: notify admins when pending submission backlog crosses threshold.
-- This is intentionally DB-only to avoid disturbing existing frontend/business logic.

CREATE OR REPLACE FUNCTION public.notify_admins_on_pending_backlog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_total integer;
  backlog_threshold constant integer := 10;
  has_recent_alert boolean;
BEGIN
  -- Ignore rows that are unrelated to pending status transitions.
  IF TG_OP = 'INSERT' AND COALESCE(NEW.status, '') <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.status, '') <> 'pending'
     AND COALESCE(OLD.status, '') <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO pending_total
  FROM public.mission_submissions
  WHERE status = 'pending';

  IF pending_total < backlog_threshold THEN
    RETURN NEW;
  END IF;

  -- Prevent alert spam: only one backlog alert every 2 hours.
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.title = 'Pending review backlog alert'
      AND n.created_at > (now() - interval '2 hours')
  ) INTO has_recent_alert;

  IF has_recent_alert THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, is_read)
  SELECT
    p.id,
    'Pending review backlog alert',
    'There are currently ' || pending_total || ' pending mission submissions waiting for review.',
    'mission',
    false
  FROM public.profiles p
  WHERE COALESCE(p.role::text, '') IN ('admin', 'school_admin');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_pending_backlog ON public.mission_submissions;
CREATE TRIGGER trg_notify_admins_on_pending_backlog
AFTER INSERT OR UPDATE OF status, reviewed_at ON public.mission_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_pending_backlog();
