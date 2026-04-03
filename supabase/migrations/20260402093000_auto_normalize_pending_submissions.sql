-- Auto-normalize submitted/in_progress rows to pending when proof is uploaded
-- This ensures consistent teacher queue visibility regardless of client status naming

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION normalize_pending_submissions()
RETURNS TRIGGER AS $$
BEGIN
  -- When submitted_at is set and reviewed_at is null, normalize status to 'pending'
  -- This handles mobile clients that may send status='submitted' or stuck 'in_progress'
  IF NEW.submitted_at IS NOT NULL 
     AND NEW.reviewed_at IS NULL 
     AND NEW.status IN ('submitted', 'in_progress') THEN
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS mission_submissions_normalize_pending ON public.mission_submissions;

-- Create trigger on insert and update
CREATE TRIGGER mission_submissions_normalize_pending
BEFORE INSERT OR UPDATE ON public.mission_submissions
FOR EACH ROW
EXECUTE FUNCTION normalize_pending_submissions();

-- Backfill: normalize any existing submitted/in_progress rows that have submitted_at but no review
UPDATE public.mission_submissions
SET status = 'pending', updated_at = NOW()
WHERE submitted_at IS NOT NULL
  AND reviewed_at IS NULL
  AND status IN ('submitted', 'in_progress');
