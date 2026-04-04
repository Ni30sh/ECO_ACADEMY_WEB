-- Store teacher sign-in events for audit and troubleshooting.
-- Teachers can write/read their own entries; admins can read/manage all.

CREATE TABLE IF NOT EXISTS public.teacher_signin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signed_in_at timestamptz NOT NULL DEFAULT now(),
  provider text,
  ip_address inet,
  user_agent text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_signin_events_teacher_id
  ON public.teacher_signin_events (teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_signin_events_signed_in_at
  ON public.teacher_signin_events (signed_in_at DESC);

ALTER TABLE public.teacher_signin_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_signin_events_insert_own ON public.teacher_signin_events;
CREATE POLICY teacher_signin_events_insert_own ON public.teacher_signin_events
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'teacher'
      OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'teacher'
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND COALESCE(p.role, '') = 'teacher'
      )
    )
  );

DROP POLICY IF EXISTS teacher_signin_events_select_own ON public.teacher_signin_events;
CREATE POLICY teacher_signin_events_select_own ON public.teacher_signin_events
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS teacher_signin_events_admin_full_access ON public.teacher_signin_events;
CREATE POLICY teacher_signin_events_admin_full_access ON public.teacher_signin_events
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
