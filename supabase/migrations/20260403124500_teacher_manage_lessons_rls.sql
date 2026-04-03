-- Allow teachers/admins to manage lesson content from web teacher workspace.

DROP POLICY IF EXISTS lessons_teacher_admin_insert ON public.lessons;
CREATE POLICY lessons_teacher_admin_insert ON public.lessons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_or_admin_user());

DROP POLICY IF EXISTS lessons_teacher_admin_update ON public.lessons;
CREATE POLICY lessons_teacher_admin_update ON public.lessons
  FOR UPDATE TO authenticated
  USING (public.is_teacher_or_admin_user())
  WITH CHECK (public.is_teacher_or_admin_user());

DROP POLICY IF EXISTS lessons_teacher_admin_delete ON public.lessons;
CREATE POLICY lessons_teacher_admin_delete ON public.lessons
  FOR DELETE TO authenticated
  USING (public.is_teacher_or_admin_user());

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
