-- Ensure authenticated users can self-create their own profile row when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Broaden submission visibility so teacher/admin accounts can review student submissions
-- even when profile-role linkage is delayed.
DROP POLICY IF EXISTS mission_submissions_select_own ON public.mission_submissions;
CREATE POLICY mission_submissions_select_own ON public.mission_submissions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('admin', 'teacher')
    )
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'teacher')
  );

DROP POLICY IF EXISTS mission_submissions_update_own ON public.mission_submissions;
CREATE POLICY mission_submissions_update_own ON public.mission_submissions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('admin', 'teacher')
    )
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'teacher')
  );
