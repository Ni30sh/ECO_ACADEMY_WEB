-- Ensure teacher queue ordering remains correct even if clients omit submitted_at

CREATE OR REPLACE FUNCTION normalize_pending_submissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize review-pending states to a single status for teacher workflows.
  IF NEW.reviewed_at IS NULL AND NEW.status IN ('submitted', 'in_progress') THEN
    NEW.status := 'pending';
  END IF;

  -- Guarantee a submit timestamp for pending-review rows so ordering is stable.
  IF NEW.reviewed_at IS NULL AND NEW.status = 'pending' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := COALESCE(NEW.updated_at, NEW.created_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing pending rows without submitted_at to avoid them sinking in UI ordering.
UPDATE public.mission_submissions
SET submitted_at = COALESCE(updated_at, created_at, NOW()),
    updated_at = NOW()
WHERE reviewed_at IS NULL
  AND status = 'pending'
  AND submitted_at IS NULL;
