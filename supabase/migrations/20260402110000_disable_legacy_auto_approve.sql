-- Disable legacy client-driven auto-approval.
-- This function previously converted pending submissions to approved after 2 minutes,
-- which made teacher review queues appear empty.

CREATE OR REPLACE FUNCTION public.auto_approve_pending_submissions(p_user_id UUID)
RETURNS SETOF public.mission_submissions AS $$
BEGIN
  -- Intentionally no-op: approvals must be performed by teacher/admin review flow.
  RETURN QUERY
  SELECT ms.*
  FROM public.mission_submissions ms
  WHERE ms.user_id = p_user_id
    AND ms.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
