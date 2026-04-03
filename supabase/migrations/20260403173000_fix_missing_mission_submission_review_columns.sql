-- Fix environments where review-related mission_submissions columns were not added.
-- This migration is idempotent and safe to run multiple times.

ALTER TABLE public.mission_submissions
  ADD COLUMN IF NOT EXISTS teacher_feedback text;

ALTER TABLE public.mission_submissions
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE public.mission_submissions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mission_submissions_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.mission_submissions
      ADD CONSTRAINT mission_submissions_reviewed_by_fkey
      FOREIGN KEY (reviewed_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Ask PostgREST to refresh schema cache so the new columns are immediately visible.
NOTIFY pgrst, 'reload schema';
