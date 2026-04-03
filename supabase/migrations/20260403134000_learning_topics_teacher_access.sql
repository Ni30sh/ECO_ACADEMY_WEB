-- Allow teachers/admins to manage the real learning_topics table.
-- This keeps the UI simple while the database owns the hidden topic ids.

ALTER TABLE public.learning_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_topics_select_public ON public.learning_topics;
CREATE POLICY learning_topics_select_public ON public.learning_topics
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS learning_topics_teacher_admin_insert ON public.learning_topics;
CREATE POLICY learning_topics_teacher_admin_insert ON public.learning_topics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_or_admin_user());

DROP POLICY IF EXISTS learning_topics_teacher_admin_update ON public.learning_topics;
CREATE POLICY learning_topics_teacher_admin_update ON public.learning_topics
  FOR UPDATE TO authenticated
  USING (public.is_teacher_or_admin_user())
  WITH CHECK (public.is_teacher_or_admin_user());

DROP POLICY IF EXISTS learning_topics_teacher_admin_delete ON public.learning_topics;
CREATE POLICY learning_topics_teacher_admin_delete ON public.learning_topics
  FOR DELETE TO authenticated
  USING (public.is_teacher_or_admin_user());
