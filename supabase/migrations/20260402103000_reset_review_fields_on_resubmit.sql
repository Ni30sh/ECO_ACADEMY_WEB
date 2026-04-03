-- Ensure resubmissions always re-enter teacher review queue cleanly.
-- If a previously approved/rejected submission is resubmitted, clear old review markers.

CREATE OR REPLACE FUNCTION normalize_pending_submissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize review-pending statuses.
  IF NEW.status IN ('submitted', 'in_progress') THEN
    NEW.status := 'pending';
  END IF;

  -- Any pending review should not retain old review metadata.
  IF NEW.status = 'pending' THEN
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.rejection_reason := NULL;
  END IF;

  -- Guarantee queue ordering timestamp.
  IF NEW.status = 'pending' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := COALESCE(NEW.updated_at, NEW.created_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill old rows that are pending but still contain stale review markers.
UPDATE public.mission_submissions
SET reviewed_by = NULL,
    reviewed_at = NULL,
    rejection_reason = NULL,
    submitted_at = COALESCE(submitted_at, updated_at, created_at, NOW()),
    updated_at = NOW()
WHERE status = 'pending'
  AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR rejection_reason IS NOT NULL OR submitted_at IS NULL);
