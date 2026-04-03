-- Protected admin allowlist for role-locking.
-- Admin emails listed here can never be downgraded from role='admin'.

CREATE TABLE IF NOT EXISTS public.protected_admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_protected_admin_emails_lower
  ON public.protected_admin_emails (lower(email));

-- Seed primary protected admin account.
INSERT INTO public.protected_admin_emails (email)
SELECT 'admin1@gmail.com'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.protected_admin_emails
  WHERE lower(email) = lower('admin1@gmail.com')
);

CREATE OR REPLACE FUNCTION public.enforce_protected_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.protected_admin_emails pae
      ON lower(pae.email) = lower(u.email)
    WHERE u.id = NEW.id
  ) THEN
    NEW.role := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_protected_admin_roles ON public.profiles;
CREATE TRIGGER trg_enforce_protected_admin_roles
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_protected_admin_roles();
