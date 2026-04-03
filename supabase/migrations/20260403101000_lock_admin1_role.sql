-- Prevent accidental role downgrade for the primary admin account.
-- If admin1@gmail.com is updated with any non-admin role, DB forces role back to admin.

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
    WHERE u.id = NEW.id
      AND lower(u.email) = lower('admin1@gmail.com')
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
