-- Ensure teacher-created missions can persist ownership metadata in the live schema.

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Optional foreign key for ownership tracking; safe to skip if already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_created_by_fkey'
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_missions_created_by ON public.missions(created_by);
